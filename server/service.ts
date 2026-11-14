import { randomUUID } from "node:crypto";
import {
  advanceWorld,
  createWorld,
  fallbackDecisions,
} from "../src/world/engine.js";
import type { Provider, Snapshot, Usage, World } from "../src/world/types.js";
import { type Database, transaction } from "./db.js";
import {
  budgets,
  HttpError,
  providerConfig,
  providerStatuses,
} from "./config.js";
import {
  decide,
  type Decide,
  makePrompt,
  MAX_OUTPUT_TOKENS,
} from "./providers.js";
const providers: Provider[] = ["terra", "sonnet"];
const busy = () =>
  new HttpError(
    409,
    "TICK_IN_PROGRESS",
    "A tick is already in progress. Try again shortly.",
  );
export class Simulation {
  constructor(
    private db: Database,
    private ai: Decide = decide,
  ) {}
  private async initialize() {
    await this.db.query(
      "INSERT INTO worlds(id, state) VALUES ('main', $1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(createWorld())],
    );
  }
  async snapshot(): Promise<Snapshot> {
    await this.initialize();
    const [state, usage] = await Promise.all([
      this.db.query("SELECT state FROM worlds WHERE id='main'"),
      this.db.query(
        "SELECT * FROM usage_daily WHERE day=(now() AT TIME ZONE 'UTC')::date ORDER BY provider",
      ),
    ]);
    return {
      world: state.rows[0].state,
      storage: "postgres",
      providers: providerStatuses(),
      budgets: budgets(),
      usage: usage.rows.map((r): Usage => ({
        provider: r.provider,
        day: String(r.day),
        chargedTokens: Number(r.charged_tokens),
        actualTokens: Number(r.actual_tokens),
        chargedMicros: Number(r.charged_micros),
        actualMicros: Number(r.actual_micros),
        calls: r.calls,
        errors: r.errors,
      })),
    };
  }
  async tick(id: string, scheduled = false) {
    await this.initialize();
    const lease = randomUUID();
    const acquired = await transaction(this.db, async (c) => {
      const {
        rows: [row],
      } = await c.query(
        "SELECT *, lease_until > now() AS busy FROM worlds WHERE id='main' FOR UPDATE",
      );
      const duplicate = await c.query("SELECT status FROM ticks WHERE id=$1", [
        id,
      ]);
      if (duplicate.rows[0]?.status === "done") return null;
      if (row.busy) throw busy();
      const w = row.state as World;
      if (scheduled && w.paused) return null;
      const day = (
        await c.query(
          "SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day",
        )
      ).rows[0].day;
      const reservations: {
        provider: Provider;
        tokens: number;
        micros: number;
        inputCap: number;
        prompt: string;
      }[] = [];
      const issues: string[] = [];
      if (w.mode === "ai") {
        for (const provider of providers) {
          const status = providerStatuses().find(
            (s) => s.provider === provider,
          )!;
          if (!status.configured) {
            issues.push(`${provider}: ${status.issue} Demo fallback used.`);
            continue;
          }
          const prompt = makePrompt(w, provider),
            cfg = providerConfig(provider);
          // UTF-8 byte count bounds text tokens; overhead covers schema and API framing.
          const inputCap = Buffer.byteLength(prompt, "utf8") + 4096;
          const tokens = inputCap + MAX_OUTPUT_TOKENS;
          const micros = Math.ceil(
            inputCap * cfg.inputRate + MAX_OUTPUT_TOKENS * cfg.outputRate,
          );
          const b = budgets();
          await c.query(
            "INSERT INTO usage_daily(day,provider) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [day, provider],
          );
          const rows = (
            await c.query("SELECT * FROM usage_daily WHERE day=$1 FOR UPDATE", [
              day,
            ])
          ).rows;
          const own = rows.find((r) => r.provider === provider)!;
          const totalTokens = rows.reduce(
              (n, r) => n + Number(r.charged_tokens),
              0,
            ),
            totalMicros = rows.reduce(
              (n, r) => n + Number(r.charged_micros),
              0,
            );
          if (
            totalTokens + tokens > b.dailyTokens ||
            totalMicros + micros > b.dailyUsd * 1e6 ||
            Number(own.charged_tokens) + tokens > b.providerDailyTokens ||
            Number(own.charged_micros) + micros > b.providerDailyUsd * 1e6
          ) {
            issues.push(
              `${provider}: daily budget reached. AI calls paused; demo fallback used.`,
            );
            continue;
          }
          await c.query(
            "UPDATE usage_daily SET charged_tokens=charged_tokens+$3, charged_micros=charged_micros+$4, calls=calls+1 WHERE day=$1 AND provider=$2",
            [day, provider, tokens, micros],
          );
          reservations.push({ provider, tokens, micros, inputCap, prompt });
        }
      }
      await c.query(
        "INSERT INTO ticks(id,status) VALUES($1,'running') ON CONFLICT(id) DO UPDATE SET status='running', created_at=now()",
        [id],
      );
      await c.query(
        "UPDATE worlds SET lease_token=$1, lease_until=now()+interval '90 seconds' WHERE id='main'",
        [lease],
      );
      return {
        world: w,
        reservations,
        issues,
        day,
        revision: Number(row.revision),
      };
    });
    if (!acquired) return { ...(await this.snapshot()), duplicate: true };
    const outcomes = await Promise.all(
      acquired.reservations.map(async (r) => {
        try {
          const result = await this.ai(r.provider, acquired.world, r.prompt);
          if (
            result.inputTokens > r.inputCap ||
            result.outputTokens > MAX_OUTPUT_TOKENS
          )
            throw new Error("USAGE_EXCEEDED_RESERVATION");
          return { reservation: r, result };
        } catch {
          return { reservation: r, result: null };
        }
      }),
    );
    const decisions = fallbackDecisions(acquired.world);
    for (const o of outcomes)
      if (o.result)
        for (const d of o.result.decisions) {
          const i = decisions.findIndex((x) => x.citizenId === d.citizenId);
          if (i >= 0) decisions[i] = d;
        }
    const world = advanceWorld(acquired.world, decisions);
    const issues = [
      ...acquired.issues,
      ...outcomes
        .filter((o) => !o.result)
        .map(
          (o) =>
            `${o.reservation.provider}: configured model request failed or returned invalid data. Demo fallback used; worst-case usage retained.`,
        ),
    ];
    for (const [i, text] of issues.entries())
      world.events.unshift({
        id: `system-${world.tick}-${i}`,
        tick: world.tick,
        type: "system",
        text,
      });
    await transaction(this.db, async (c) => {
      const {
        rows: [row],
      } = await c.query(
        "SELECT lease_token,revision FROM worlds WHERE id='main' FOR UPDATE",
      );
      if (
        row.lease_token !== lease ||
        Number(row.revision) !== acquired.revision
      )
        throw new HttpError(
          409,
          "LEASE_LOST",
          "This tick was superseded. No stale state was written.",
        );
      for (const o of outcomes) {
        const r = o.reservation;
        if (!o.result) {
          await c.query(
            "UPDATE usage_daily SET errors=errors+1 WHERE day=$1 AND provider=$2",
            [acquired.day, r.provider],
          );
          continue;
        }
        const cfg = providerConfig(r.provider),
          tokens = o.result.inputTokens + o.result.outputTokens;
        const micros = Math.ceil(
          o.result.inputTokens * cfg.inputRate +
            o.result.outputTokens * cfg.outputRate,
        );
        await c.query(
          "UPDATE usage_daily SET charged_tokens=charged_tokens-$3+$5, charged_micros=charged_micros-$4+$6, actual_tokens=actual_tokens+$5, actual_micros=actual_micros+$6 WHERE day=$1 AND provider=$2",
          [acquired.day, r.provider, r.tokens, r.micros, tokens, micros],
        );
      }
      await c.query(
        "UPDATE worlds SET state=$1::jsonb, revision=revision+1, lease_token=NULL, lease_until=NULL WHERE id='main'",
        [JSON.stringify(world)],
      );
      await c.query("UPDATE ticks SET status='done',revision=$2 WHERE id=$1", [
        id,
        acquired.revision + 1,
      ]);
      // Keep a bounded idempotency journal; keys are valid only within 24h at the API boundary.
      await c.query(
        "DELETE FROM ticks WHERE created_at < now()-interval '2 days'",
      );
    });
    return this.snapshot();
  }
  async control(command: {
    action: "pause" | "play" | "mode" | "speed" | "save" | "load";
    value?: string | number;
  }) {
    await this.initialize();
    await transaction(this.db, async (c) => {
      const {
        rows: [row],
      } = await c.query(
        "SELECT *,lease_until>now() AS busy FROM worlds WHERE id='main' FOR UPDATE",
      );
      if (row.busy) throw busy();
      const w: World = row.state;
      switch (command.action) {
        case "pause":
          w.paused = true;
          break;
        case "play":
          w.paused = false;
          break;
        case "mode":
          if (command.value !== "demo" && command.value !== "ai")
            throw new HttpError(400, "INVALID_MODE", "Choose demo or ai.");
          if (
            command.value === "ai" &&
            providerStatuses().some((p) => !p.configured)
          )
            throw new HttpError(
              503,
              "AI_NOT_CONFIGURED",
              "Both exact model IDs, keys and pricing must be configured before enabling AI.",
            );
          w.mode = command.value;
          break;
        case "speed":
          if (![1, 2, 4].includes(Number(command.value)))
            throw new HttpError(400, "INVALID_SPEED", "Choose 1, 2 or 4.");
          w.speed = Number(command.value);
          break;
        case "save":
          await c.query(
            "INSERT INTO saves(id,state) VALUES('manual',$1::jsonb) ON CONFLICT(id) DO UPDATE SET state=excluded.state,created_at=now()",
            [JSON.stringify(w)],
          );
          return;
        case "load": {
          const save = (
            await c.query("SELECT state FROM saves WHERE id='manual'")
          ).rows[0];
          if (!save)
            throw new HttpError(
              404,
              "NO_SAVE",
              "No town snapshot has been saved.",
            );
          const loaded: World = save.state;
          loaded.updatedAt = new Date().toISOString();
          loaded.paused = true;
          await c.query(
            "UPDATE worlds SET state=$1::jsonb,revision=revision+1 WHERE id='main'",
            [JSON.stringify(loaded)],
          );
          return;
        }
      }
      await c.query(
        "UPDATE worlds SET state=$1::jsonb, revision=revision+1 WHERE id='main'",
        [JSON.stringify(w)],
      );
    });
    return this.snapshot();
  }
}
