import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, advanceWorld } from "../src/world/engine.js";
import { applyProject } from "../src/world/projects.js";
import type { Action, World } from "../src/world/types.js";
const everyone = (w: World, action: Action) =>
  w.citizens.map((c) => ({ citizenId: c.id, action }));
test("recap records all twenty real outcomes and matches authoritative resource changes", () => {
  const before = createWorld(),
    after = advanceWorld(before);
  assert.equal(after.lastTick?.decisions.length, 20);
  assert.equal(after.lastTick?.food, after.food - before.food);
  assert.equal(after.lastTick?.gold, after.gold - before.gold);
  assert.equal(after.lastTick?.wood, after.wood - before.wood);
  assert.equal(
    after.lastTick?.construction,
    after.construction - before.construction,
  );
  assert.ok(
    after.lastTick?.decisions.every(
      (d) =>
        d.summary.includes(
          after.citizens.find((c) => c.id === d.citizenId)!.name,
        ) &&
        !d.summary.includes("undefined") &&
        d.source === "demo",
    ),
  );
});
test("projects spend resources without a tick; a farm upgrade improves actual harvests", () => {
  const before = createWorld(),
    expanded = applyProject(before, "farm");
  assert.equal(expanded.gold, before.gold - 80);
  assert.equal(expanded.wood, before.wood - 30);
  assert.equal(expanded.tick, before.tick);
  assert.ok(!before.upgrades);
  const plain = advanceWorld(before, everyone(before, "farm")),
    improved = advanceWorld(expanded, everyone(expanded, "farm"));
  assert.equal(improved.food - plain.food, 6 * 20);
  assert.throws(() => applyProject(expanded, "farm"), /already expanded/);
  const poor = createWorld();
  poor.gold = 1;
  assert.throws(() => applyProject(poor, "library"), /more resources/);
  assert.equal(poor.gold, 1);
});
test("festivals form connections, physically gather citizens, and cannot be spammed", () => {
  const w = createWorld(),
    celebrated = applyProject(w, "festival");
  assert.equal(celebrated.gold, w.gold - 60);
  assert.equal(celebrated.tick, w.tick);
  assert.equal(celebrated.celebrationTick, w.tick);
  for (const c of celebrated.citizens) {
    assert.equal(c.action, "socialize");
    assert.equal(c.playerDirected, true);
    assert.ok(Math.hypot(...c.position) < 5);
    assert.ok(Object.values(c.relationships).some((n) => n === 8));
    assert.equal(
      c.happiness,
      Math.min(100, w.citizens.find((p) => p.id === c.id)!.happiness + 10),
    );
  }
  assert.throws(() => applyProject(celebrated, "festival"), /next town day/);
  const next = advanceWorld(celebrated);
  assert.ok(next.citizens.every((c) => !c.playerDirected));
});
test("snap elections resolve on the next tick with exactly twenty votes and a cooldown", () => {
  const w = createWorld(),
    called = applyProject(w, "election");
  assert.equal(called.tick, 0);
  assert.equal(called.gold, w.gold - 45);
  assert.equal(called.electionRequested, true);
  assert.throws(() => applyProject(called, "election"), /already called/);
  const result = advanceWorld(called);
  assert.equal(result.elections.length, 1);
  assert.equal(
    Object.values(result.elections[0].votes).reduce((a, b) => a + b, 0),
    20,
  );
  assert.equal(result.electionRequested, false);
  assert.equal(result.celebrationTick, 1);
  assert.throws(() => applyProject(result, "election"), /next town day/);
});
test("a crisis closes trade, requires funded repairs, and awards success only for useful work", () => {
  let w = createWorld();
  w.tick = 2;
  w = advanceWorld(w, everyone(w, "rest"));
  assert.equal(w.challenge?.kind, "repair");
  assert.equal(w.challenge?.status, "active");
  const traded = advanceWorld(w, everyone(w, "trade"));
  assert.ok(
    traded.lastTick?.decisions.every((d) =>
      d.summary.includes("market closed"),
    ),
  );
  assert.equal(traded.challenge?.progress, 0);
  const poor = structuredClone(w);
  poor.wood = 0;
  const blocked = advanceWorld(poor, everyone(poor, "build"));
  assert.equal(blocked.challenge?.progress, 0);
  const repaired = advanceWorld(w, everyone(w, "build"));
  assert.equal(repaired.challenge?.status, "won");
  assert.equal(repaired.challenge?.progress, 6);
  assert.ok(repaired.events.some((e) => e.text.includes("pulled together")));
});
test("ignoring a challenge produces a lasting consequence and completed libraries consume no extra timber", () => {
  let w = createWorld();
  w.tick = 2;
  w = advanceWorld(w, everyone(w, "rest"));
  while (w.tick < 8) w = advanceWorld(w, everyone(w, "rest"));
  assert.equal(w.challenge?.status, "lost");
  assert.ok(w.events.some((e) => e.text.includes("time ran out")));
  const completed = createWorld();
  completed.construction = 100;
  const after = advanceWorld(completed, everyone(completed, "build"));
  assert.equal(after.wood, completed.wood);
  assert.ok(
    after.lastTick?.decisions.every((d) =>
      d.summary.includes("library is complete"),
    ),
  );
});

test("paused movement survives refresh and resumes from its frozen progress after a manual tick", async () => {
  const { movementProgress, setPlayback } =
    await import("../src/world/motion.js");
  const w = createWorld("2026-01-01T00:00:00Z");
  setPlayback(w, true, "2026-01-01T00:00:06Z");
  assert.equal(movementProgress(w, Date.parse("2026-01-01T00:10:00Z")), 0.5);
  assert.equal(movementProgress(structuredClone(w)), 0.5);
  setPlayback(w, false, "2026-01-01T00:01:06Z");
  assert.equal(movementProgress(w, Date.parse("2026-01-01T00:01:06Z")), 0.5);
  setPlayback(w, true, "2026-01-01T00:01:07Z");
  const stepped = advanceWorld(w, undefined, "2026-01-01T00:05:00Z");
  setPlayback(stepped, false, "2026-01-01T00:05:02Z");
  assert.equal(
    movementProgress(stepped, Date.parse("2026-01-01T00:05:08Z")),
    0.5,
  );
});
