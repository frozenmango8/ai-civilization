import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceWorld, createWorld } from "../src/world/engine.js";
import {
  recordSocialAction,
  resolveProposals,
  writingDecision,
} from "../src/world/society.js";
import { validateDecisions } from "../server/providers.js";
import type { World } from "../src/world/types.js";
const rest = (w: World) =>
  w.citizens.map((c) => ({ citizenId: c.id, action: "rest" as const }));
test("journals persist exact authored text, create memories, and happen inside the home", () => {
  const w = createWorld(),
    c = w.citizens[0],
    d = writingDecision(c, w, "reflect");
  d.writing!.body = "I planted the first row. I hope my neighbor notices.";
  const next = advanceWorld(w, [d, ...rest(w).slice(1)]);
  assert.equal(next.writings?.[0].body, d.writing!.body);
  assert.equal(next.writings?.[0].authorId, c.id);
  assert.equal(next.writings?.[0].kind, "diary");
  assert.equal(next.writings?.[0].source, "demo");
  assert.ok(next.citizens[0].memories[0].includes("journal"));
  assert.ok(
    Math.hypot(
      next.citizens[0].position[0] - c.position[0],
      next.citizens[0].position[1] - c.position[1],
    ) < 3,
  );
  assert.equal(w.writings, undefined);
});
test("each citizen casts one ballot per proposal; duplicate votes cannot change the result", () => {
  const w = createWorld(),
    author = w.citizens[0];
  recordSocialAction(w, author, writingDecision(author, w, "propose"));
  const proposal = w.proposals![0],
    voter = w.citizens[1];
  const d = writingDecision(voter, w, "vote", proposal.id);
  d.writing!.stance = "yes";
  recordSocialAction(w, voter, d);
  d.writing!.stance = "no";
  const duplicate = recordSocialAction(w, voter, d);
  assert.equal(proposal.votes[voter.id], "yes");
  assert.equal(Object.keys(proposal.votes).length, 1);
  assert.ok(duplicate.summary.includes("already voted"));
});
test("a quorum and majority create a binding two-day priority, and minority votes remain recorded", () => {
  let w = createWorld();
  recordSocialAction(
    w,
    w.citizens[0],
    writingDecision(w.citizens[0], w, "propose"),
  );
  const p = w.proposals![0];
  p.priority = "wellbeing";
  for (const [i, c] of w.citizens.slice(0, 9).entries()) {
    const d = writingDecision(c, w, "vote", p.id);
    d.writing!.stance = i < 8 ? "yes" : "no";
    recordSocialAction(w, c, d);
  }
  w.tick = p.closesAt;
  resolveProposals(w);
  assert.equal(p.status, "passed");
  assert.equal(w.priority, "wellbeing");
  assert.equal(w.mandate?.until, w.tick + 12);
  const next = advanceWorld(w, [
    ...rest(w).filter((d) => d.citizenId !== w.mayor),
    {
      citizenId: w.mayor,
      action: "rest",
      policy: { tax: 0.2, priority: "infrastructure" },
    },
  ]);
  assert.equal(next.priority, "wellbeing");
  assert.equal(next.tax, 0.2);
  assert.equal(Object.values(p.votes).filter((v) => v === "no").length, 1);
});
test("a proposal without eight voters is rejected and never silently enacts a policy", () => {
  const w = createWorld();
  recordSocialAction(
    w,
    w.citizens[0],
    writingDecision(w.citizens[0], w, "propose"),
  );
  const p = w.proposals![0];
  p.priority = "wellbeing";
  p.votes[w.citizens[0].id] = "yes";
  w.tick = p.closesAt;
  resolveProposals(w);
  assert.equal(p.status, "rejected");
  assert.equal(w.priority, "food");
  assert.equal(w.mandate, undefined);
});
test("writings are bounded to five pieces per author and political proposals cannot grow without limit", () => {
  const w = createWorld();
  for (let i = 0; i < 30; i++) {
    w.tick++;
    for (const c of w.citizens)
      recordSocialAction(w, c, writingDecision(c, w, "reflect"));
  }
  assert.equal(w.writings?.length, 100);
  for (const c of w.citizens)
    assert.equal(w.writings?.filter((e) => e.authorId === c.id).length, 5);
  for (const c of w.citizens)
    recordSocialAction(w, c, writingDecision(c, w, "propose"));
  assert.equal(w.proposals?.filter((p) => p.status === "open").length, 5);
});
test("structured AI writing requires actual content and existing references", () => {
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
        writing: null as any,
      })),
  };
  data.decisions[0].action = "reflect";
  assert.throws(() => validateDecisions(data, w, "terra"));
  data.decisions[0].writing = writingDecision(
    w.citizens[0],
    w,
    "reflect",
  ).writing;
  assert.equal(validateDecisions(data, w, "terra").length, 10);
  data.decisions[0].writing.referenceId = "nonexistent";
  assert.throws(() => validateDecisions(data, w, "terra"));
  data.decisions[0].writing.referenceId = null;
  data.decisions[0].writing.body = "x".repeat(501);
  assert.throws(() => validateDecisions(data, w, "terra"));
});
