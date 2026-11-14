import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceWorld,
  createWorld,
  fallbackDecisions,
} from "../src/world/engine";
import { buildings, pointAlong, roadPath } from "../src/world/map";
import { validateDecisions } from "../server/providers";
test("twenty distinct citizens have homes; demo progresses without keys", () => {
  const w = createWorld();
  assert.equal(w.citizens.length, 20);
  assert.equal(new Set(w.citizens.map((c) => c.name)).size, 20);
  assert.equal(w.citizens.filter((c) => c.provider === "terra").length, 10);
  assert.equal(buildings.filter((b) => b.kind === "home").length, 20);
  const next = advanceWorld(w);
  assert.equal(w.tick, 0);
  assert.equal(next.tick, 1);
  assert.notDeepEqual(
    next.citizens.map((c) => c.position),
    w.citizens.map((c) => c.position),
  );
});
test("600 deterministic ticks preserve resource bounds, memories, and one vote per citizen", () => {
  let w = createWorld();
  for (let i = 0; i < 600; i++) {
    w = advanceWorld(w);
    assert.ok(w.food >= 0 && w.wood >= 0 && w.gold >= 0);
    for (const c of w.citizens) {
      assert.ok(c.happiness >= 0 && c.happiness <= 100);
      assert.ok(c.energy >= 0 && c.energy <= 100);
      assert.ok(c.hunger >= 0 && c.hunger <= 100);
      assert.ok(c.wealth >= 0);
      assert.ok(c.memories.length <= 8);
    }
  }
  assert.equal(w.elections.length, 10);
  for (const election of w.elections)
    assert.equal(
      Object.values(election.votes).reduce((a, b) => a + b, 0),
      20,
    );
  assert.ok(w.citizens.some((c) => Object.keys(c.relationships).length > 0));
});
test("provider labels never determine fallback decisions or outcomes", () => {
  const w = createWorld();
  const flipped = structuredClone(w);
  for (const c of flipped.citizens)
    c.provider = c.provider === "terra" ? "sonnet" : "terra";
  assert.deepEqual(fallbackDecisions(w), fallbackDecisions(flipped));
  const now = "2026-01-01T00:00:00Z";
  const a = advanceWorld(w, undefined, now),
    b = advanceWorld(flipped, undefined, now);
  for (let i = 0; i < 20; i++) {
    delete (a.citizens[i] as any).provider;
    delete (b.citizens[i] as any).provider;
  }
  assert.deepEqual(a, b);
});
test("validated mayor policies cannot tax above the rules; relationship effects persist", () => {
  const w = createWorld();
  const decisions = w.citizens.map((c) => ({
    citizenId: c.id,
    action: "rest" as const,
  }));
  const next = advanceWorld(w, [
    {
      citizenId: w.mayor,
      action: "help",
      target: "citizen-2",
      policy: { tax: 10, priority: "food" },
    },
    ...decisions.filter((c) => c.citizenId !== w.mayor),
  ]);
  assert.equal(next.tax, 0.25);
  assert.equal(next.citizens[3].relationships["citizen-2"], 10);
  assert.ok(next.citizens[2].memories.some((m) => m.includes("gift")));
});
test("road interpolation traverses connected lanes and reaches its destination", () => {
  const path = roadPath([-23, -29], [12, 7]);
  assert.deepEqual(path, [
    [-23, -29],
    [-23, -16],
    [0, -16],
    [0, 0],
    [12, 0],
    [12, 7],
  ]);
  assert.deepEqual(pointAlong(path, 0), [-23, -29]);
  assert.deepEqual(pointAlong(path, 1), [12, 7]);
  assert.ok(pointAlong(path, 0.5).every(Number.isFinite));
});
test("provider responses reject duplicate IDs, other factions, illegal targets, and unauthorized policy", () => {
  const w = createWorld();
  const data = {
    decisions: w.citizens
      .slice(0, 10)
      .map((c) => ({
        citizenId: c.id,
        action: "rest",
        target: null,
        message: "Hello",
        policy: null,
      })),
  };
  assert.equal(validateDecisions(data, w, "terra").length, 10);
  const duplicate = structuredClone(data);
  duplicate.decisions[1].citizenId = "citizen-0";
  assert.throws(() => validateDecisions(duplicate, w, "terra"));
  assert.throws(() => validateDecisions(data, w, "sonnet"));
  const bad = structuredClone(data);
  bad.decisions[0].target = "missing" as any;
  assert.throws(() => validateDecisions(bad, w, "terra"));
  const policy = structuredClone(data);
  policy.decisions[0].policy = { tax: 0.1, priority: "food" } as any;
  assert.throws(() => validateDecisions(policy, w, "terra"));
});
