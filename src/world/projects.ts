import type { World } from "./types.js";
export const projects = [
  {
    id: "festival",
    name: "Throw a town festival",
    gold: 60,
    wood: 0,
    cost: "60 gold",
    description:
      "+10 happiness, new friendships, and a celebration in the square. Once per town day.",
  },
  {
    id: "farm",
    name: "Expand Sunfield Farm",
    gold: 80,
    wood: 30,
    cost: "80 gold · 30 wood",
    description:
      "A permanent +6 food for every farming action. Watch the new greenhouse grow.",
  },
  {
    id: "library",
    name: "Commission the library",
    gold: 60,
    wood: 40,
    cost: "60 gold · 40 wood",
    description:
      "Finish 25% of construction immediately. A completed library improves town morale.",
  },
  {
    id: "election",
    name: "Call a snap election",
    gold: 45,
    wood: 0,
    cost: "45 gold",
    description:
      "Every citizen votes on the next tick. Shake up the town’s leadership. Once per town day.",
  },
] as const;
export type ProjectId = (typeof projects)[number]["id"];
export function projectIssue(w: World, id: ProjectId): string | null {
  if (
    id === "festival" &&
    w.lastFestivalTick !== undefined &&
    w.tick - w.lastFestivalTick < 6
  )
    return "The next festival can happen on the next town day.";
  if (id === "farm" && w.upgrades?.includes("farm"))
    return "The farm is already expanded.";
  if (id === "library" && w.construction >= 100)
    return "The library is already complete.";
  if (
    id === "election" &&
    (w.electionRequested ||
      (w.lastElectionRequestTick !== undefined &&
        w.tick - w.lastElectionRequestTick < 6))
  )
    return w.electionRequested
      ? "An election is already called for the next tick."
      : "The next snap election can be called on the next town day.";
  const { gold, wood } = projects.find((p) => p.id === id)!;
  return w.gold < gold || w.wood < wood
    ? "The town needs more resources for this project."
    : null;
}
export function applyProject(previous: World, value: unknown): World {
  if (!projects.some((p) => p.id === value))
    throw new Error("Unknown town project.");
  const id = value as ProjectId,
    issue = projectIssue(previous, id);
  if (issue) throw new Error(issue);
  const w = structuredClone(previous);
  const definition = projects.find((p) => p.id === id)!;
  w.gold -= definition.gold;
  w.wood -= definition.wood;
  let text = "";
  if (id === "festival") {
    w.lastFestivalTick = w.tick;
    w.celebrationTick = w.tick;
    for (const [i, c] of w.citizens.entries()) {
      c.playerDirected = true;
      c.previousPosition = [...c.position];
      c.position = [Math.cos(i * 0.8) * 3, 1 + Math.sin(i * 0.8) * 3];
      c.action = "socialize";
      c.target = w.citizens[(i + 1) % 20].id;
      c.message = "For once, let’s put our differences aside.";
      c.happiness = Math.min(100, c.happiness + 10);
      c.relationships[c.target] = Math.min(
        100,
        (c.relationships[c.target] ?? 0) + 8,
      );
      c.memories = [
        "The whole town celebrated together at the square.",
        ...c.memories,
      ].slice(0, 8);
    }
    text =
      "The town threw a festival! Every citizen gained 10 happiness and met a neighbor.";
  } else if (id === "farm") {
    w.upgrades = [...(w.upgrades ?? []), "farm"];
    text =
      "Sunfield Farm expanded! Every farmer now harvests 6 extra food per action.";
  } else if (id === "election") {
    w.electionRequested = true;
    w.lastElectionRequestTick = w.tick;
    text =
      "The council called a snap election! Every citizen will cast one vote on the next tick.";
  } else {
    w.construction = Math.min(100, w.construction + 25);
    if (w.construction === 100) {
      for (const c of w.citizens) c.happiness = Math.min(100, c.happiness + 8);
      w.celebrationTick = w.tick;
    }
    text = `The town funded the library: construction is now ${w.construction}%.${w.construction === 100 ? " The doors are open!" : ""}`;
  }
  w.events.unshift({
    id: `project-${id}-${w.tick}-${w.construction}`,
    tick: w.tick,
    type: "world",
    text,
  });
  w.events = w.events.slice(0, 60);
  w.updatedAt = new Date().toISOString();
  return w;
}
