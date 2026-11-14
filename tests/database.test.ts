import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import type { Database, DBClient } from "../server/db.js";
import { schema } from "../server/schema.js";
import { Simulation } from "../server/service.js";
import { fallbackDecisions } from "../src/world/engine.js";
import { handle } from "../server/http.js";
const pg = new PGlite();
// PGlite supplies real Postgres SQL. Serialize its one connection like a pool does.
let tail = Promise.resolve();
async function acquire() {
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  const previous = tail;
  tail = tail.then(() => next);
  await previous;
  return release;
}
const query = async (sql: string, values?: unknown[]) => {
  const r = await pg.query(sql, values);
  return { rows: r.rows as any[] };
};
const db: Database = {
  query: async (sql, values) => {
    const release = await acquire();
    try {
      return await query(sql, values);
    } finally {
      release();
    }
  },
  connect: async () => {
    const release = await acquire();
    return { query, release } as DBClient;
  },
};
before(async () => {
  await pg.exec(schema);
});
beforeEach(async () => {
  await pg.exec("TRUNCATE worlds,ticks,usage_daily,saves");
  for (const key of [
    "DAILY_TOKEN_BUDGET",
    "DAILY_USD_BUDGET",
    "PROVIDER_DAILY_TOKEN_BUDGET",
    "PROVIDER_DAILY_USD_BUDGET",
  ])
    delete process.env[key];
  for (const prefix of ["OPENAI", "ANTHROPIC"]) {
    process.env[`${prefix}_MODEL`] = "test-explicit-model";
    process.env[`${prefix}_API_KEY`] = "test-key-never-exposed";
    process.env[`${prefix}_INPUT_USD_PER_MILLION`] = "1";
    process.env[`${prefix}_OUTPUT_USD_PER_MILLION`] = "2";
  }
});
after(async () => {
  await pg.close();
});
const fakeAI: ConstructorParameters<typeof Simulation>[1] = async (
  provider,
  w,
) => ({
  decisions: fallbackDecisions(w).filter(
    (d) => w.citizens.find((c) => c.id === d.citizenId)!.provider === provider,
  ),
  inputTokens: 100,
  outputTokens: 100,
});
test("shared state persists across separate service instances and idempotent retries", async () => {
  const a = new Simulation(db),
    b = new Simulation(db);
  await a.tick("same-tick");
  await b.tick("same-tick");
  assert.equal((await b.snapshot()).world.tick, 1);
  await b.tick("next-tick");
  assert.equal((await a.snapshot()).world.tick, 2);
});
test("overlapping AI ticks are excluded while provider decisions execute in parallel", async () => {
  let calls = 0;
  let unblock!: () => void;
  const gate = new Promise<void>((r) => (unblock = r));
  const s = new Simulation(db, async (p, w, prompt) => {
    calls++;
    await gate;
    return fakeAI!(p, w, prompt);
  });
  await s.control({ action: "mode", value: "ai" });
  const first = s.tick("parallel-a");
  while (calls < 2) await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(
    () => s.tick("parallel-b"),
    (e: any) => e.code === "TICK_IN_PROGRESS",
  );
  await assert.rejects(
    () => s.control({ action: "pause" }),
    (e: any) => e.code === "TICK_IN_PROGRESS",
  );
  unblock();
  await first;
  assert.equal(calls, 2);
  assert.equal((await s.snapshot()).world.tick, 1);
});
test("expired leases can be recovered without stale writers overwriting the world", async () => {
  let unblock!: () => void;
  let entered = 0;
  const gate = new Promise<void>((r) => (unblock = r));
  const slow = new Simulation(db, async (p, w, prompt) => {
    entered++;
    await gate;
    return fakeAI!(p, w, prompt);
  });
  await slow.control({ action: "mode", value: "ai" });
  const first = slow.tick("old");
  while (entered < 2) await new Promise((r) => setTimeout(r, 5));
  await db.query("UPDATE worlds SET lease_until=now()-interval '1 second'");
  await new Simulation(db, fakeAI).tick("replacement");
  unblock();
  await assert.rejects(
    () => first,
    (e: any) => e.code === "LEASE_LOST",
  );
  assert.equal((await slow.snapshot()).world.tick, 1);
});
test("budget zero blocks all paid calls and free simulation keeps evolving", async () => {
  let calls = 0;
  process.env.DAILY_USD_BUDGET = "0";
  const s = new Simulation(db, async (...args) => {
    calls++;
    return fakeAI!(...args);
  });
  await s.control({ action: "mode", value: "ai" });
  await s.tick("budget");
  const snapshot = await s.snapshot();
  assert.equal(calls, 0);
  assert.equal(snapshot.world.tick, 1);
  assert.ok(
    snapshot.world.events.some((e) => e.text.includes("budget reached")),
  );
  assert.equal(
    snapshot.usage.reduce((n, u) => n + u.chargedMicros, 0),
    0,
  );
});
test("actual usage is tracked separately for both providers, refunded only after success", async () => {
  const s = new Simulation(db, fakeAI);
  await s.control({ action: "mode", value: "ai" });
  await s.tick("ai-ok");
  const snapshot = await s.snapshot();
  assert.equal(snapshot.usage.length, 2);
  for (const u of snapshot.usage) {
    assert.equal(u.chargedTokens, 200);
    assert.equal(u.actualTokens, 200);
    assert.equal(u.chargedMicros, 300);
    assert.equal(u.calls, 1);
    assert.equal(u.errors, 0);
  }
  assert.ok(!JSON.stringify(snapshot).includes("test-key-never-exposed"));
});
test("uncertain provider failures retain reservations and never replay on retry", async () => {
  let calls = 0;
  const s = new Simulation(db, async () => {
    calls++;
    throw new Error("sensitive-provider-error");
  });
  await s.control({ action: "mode", value: "ai" });
  await s.tick("failure");
  await s.tick("failure");
  const snapshot = await s.snapshot();
  assert.equal(calls, 2);
  for (const u of snapshot.usage) {
    assert.ok(u.chargedTokens > 2200);
    assert.ok(u.chargedMicros > 0);
    assert.equal(u.actualTokens, 0);
    assert.equal(u.errors, 1);
  }
  assert.ok(!JSON.stringify(snapshot).includes("sensitive-provider-error"));
});
test("aggregate token budget is reserved before parallel calls", async () => {
  const s = new Simulation(db, fakeAI);
  await s.control({ action: "mode", value: "ai" });
  process.env.DAILY_TOKEN_BUDGET = "23000";
  await s.tick("aggregate");
  const snapshot = await s.snapshot();
  assert.ok(snapshot.usage.reduce((n, u) => n + u.chargedTokens, 0) <= 23000);
  assert.equal(
    snapshot.usage.reduce((n, u) => n + u.calls, 0),
    1,
  );
});
test("pause prevents scheduled ticks; operator stepping and snapshots preserve accounting", async () => {
  const s = new Simulation(db, fakeAI);
  await s.control({ action: "pause" });
  await s.tick("scheduled", true);
  assert.equal((await s.snapshot()).world.tick, 0);
  await s.control({ action: "mode", value: "ai" });
  await s.tick("manual");
  await s.control({ action: "save" });
  await s.tick("manual2");
  const before = (await s.snapshot()).usage;
  await s.control({ action: "load" });
  const loaded = await s.snapshot();
  assert.equal(loaded.world.tick, 1);
  assert.equal(loaded.world.paused, true);
  assert.deepEqual(loaded.usage, before);
});
test("missing exact model prevents real AI mode rather than substituting another model", async () => {
  delete process.env.OPENAI_MODEL;
  const s = new Simulation(db, fakeAI);
  await assert.rejects(
    () => s.control({ action: "mode", value: "ai" }),
    (e: any) => e.code === "AI_NOT_CONFIGURED",
  );
  assert.equal((await s.snapshot()).world.mode, "demo");
});
test("HTTP APIs verify authentication, methods, idempotency, and two visitors see identical world", async () => {
  const s = new Simulation(db, fakeAI);
  process.env.ADMIN_SECRET = "test-admin-secret-24-characters";
  process.env.CRON_SECRET = "test-cron-secret-24-characters";
  const server = createServer((req, res) => {
    void handle(req, res, s);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${url}/api/tick`)).status, 401);
    assert.equal(
      (await fetch(`${url}/api/control`, { method: "POST", body: "{}" }))
        .status,
      401,
    );
    const headers = {
      Authorization: `Bearer ${process.env.ADMIN_SECRET}`,
      "Idempotency-Key": `${Date.now()}:00000000-0000-0000-0000-000000000000`,
    };
    assert.equal(
      (await fetch(`${url}/api/tick`, { method: "POST", headers })).status,
      200,
    );
    assert.equal(
      (await fetch(`${url}/api/tick`, { method: "POST", headers })).status,
      200,
    );
    const [a, b] = await Promise.all([
      fetch(`${url}/api/world`).then((r) => r.json()),
      fetch(`${url}/api/world`).then((r) => r.json()),
    ]);
    assert.deepEqual(a.world, b.world);
    assert.equal(a.world.tick, 1);
    assert.equal(
      (await fetch(`${url}/api/world`, { method: "POST" })).status,
      405,
    );
    assert.equal(
      (
        await fetch(`${url}/api/tick`, {
          method: "POST",
          headers: { Authorization: headers.Authorization },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${url}/api/tick`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
      ).status,
      200,
    );
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("project changes are shared and atomic, preserve the AI ledger, and make no provider calls", async () => {
  let calls = 0;
  const s = new Simulation(db, async (...args) => {
    calls++;
    return fakeAI!(...args);
  });
  await s.control({ action: "mode", value: "ai" });
  await s.tick("before-project");
  const before = await s.snapshot();
  await s.control({ action: "project", value: "farm" });
  const after = await new Simulation(db).snapshot();
  assert.equal(after.world.tick, before.world.tick);
  assert.equal(after.world.gold, before.world.gold - 80);
  assert.equal(after.world.wood, before.world.wood - 30);
  assert.deepEqual(after.usage, before.usage);
  assert.equal(calls, 2);
  await assert.rejects(
    () => s.control({ action: "project", value: "farm" }),
    (e: any) => e.code === "PROJECT_UNAVAILABLE",
  );
  assert.equal((await s.snapshot()).world.gold, after.world.gold);
});
test("mixed AI outcomes visibly identify fallback and retain only safe failure information", async () => {
  const s = new Simulation(db, async (p, w, prompt) => {
    if (p === "sonnet") throw new Error("PROVIDER_HTTP_401");
    return fakeAI!(p, w, prompt);
  });
  await s.control({ action: "mode", value: "ai" });
  await s.tick("mixed");
  const { world, usage } = await s.snapshot();
  assert.equal(world.lastTick?.providers.terra?.status, "ai");
  assert.equal(world.lastTick?.providers.sonnet?.status, "fallback");
  assert.ok(world.lastTick?.providers.sonnet?.detail.includes("401"));
  for (const d of world.lastTick!.decisions)
    assert.equal(
      d.source,
      world.citizens.find((c) => c.id === d.citizenId)?.provider === "terra"
        ? "ai"
        : "fallback",
    );
  assert.ok(usage.find((u) => u.provider === "terra")!.actualTokens > 0);
  assert.equal(usage.find((u) => u.provider === "sonnet")!.errors, 1);
});
