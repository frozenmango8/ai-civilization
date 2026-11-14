import { buildings, names } from "./map";
import type { Citizen, Decision, Point, World } from "./types";
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const dayOf = (world: World) => Math.floor(world.tick / 6) + 1;
const jobs = [
  "Farmer",
  "Carpenter",
  "Merchant",
  "Gardener",
  "Baker",
  "Builder",
  "Woodcutter",
  "Teacher",
  "Artist",
  "Healer",
];
const personalities = [
  "Curious & kind",
  "Ambitious & bold",
  "Patient & practical",
  "Social & generous",
  "Thoughtful & inventive",
];
export function createWorld(now = new Date().toISOString()): World {
  const citizens: Citizen[] = names.map((name, i) => {
    const position = buildings.find((b) => b.id === `home-${i}`)!.position;
    return {
      id: `citizen-${i}`,
      name,
      provider: i < 10 ? "terra" : "sonnet",
      job: jobs[i % 10],
      personality: personalities[i % 5],
      home: `home-${i}`,
      color: ["#8fa3b2", "#c29673", "#92a17c", "#d5b56f", "#ac91a5"][i % 5],
      skin: ["#e3b58c", "#a57756", "#d19b77", "#785744"][i % 4],
      happiness: 68 + (i % 17),
      energy: 70 + (i % 25),
      wealth: 24 + i * 2,
      hunger: 20 + (i % 25),
      memories: ["Arrived in Little Civilization. A new beginning."],
      relationships: {},
      action: "rest",
      position: [...position],
      previousPosition: [...position],
      message: "A lovely day to begin.",
    };
  });
  return {
    version: 1,
    tick: 0,
    updatedAt: now,
    seed: 417,
    mode: "demo",
    paused: false,
    speed: 1,
    food: 240,
    gold: 680,
    wood: 120,
    construction: 12,
    tax: 0.1,
    priority: "food",
    mayor: "citizen-3",
    citizens,
    candidates: [],
    elections: [],
    events: [
      {
        id: "arrival",
        tick: 0,
        type: "world",
        text: "Twenty strangers. One little town. A story begins.",
      },
    ],
  };
}
export function fallbackDecisions(world: World): Decision[] {
  return world.citizens.map((c, i) => {
    const r = (world.tick * 7 + i * 13 + world.seed) % 29;
    const action =
      c.energy < 30 || c.hunger > 70
        ? "rest"
        : world.food < 90 || (i + world.tick) % 7 === 0
          ? "farm"
          : r < 3
            ? "campaign"
            : r < 6
              ? "socialize"
              : r < 8
                ? "alliance"
                : r < 10
                  ? "help"
                  : r === 10
                    ? "steal"
                    : r === 11
                      ? "protest"
                      : r < 15
                        ? "build"
                        : r < 18
                          ? "trade"
                          : "work";
    return {
      citizenId: c.id,
      action,
      target: world.citizens[(i + world.tick + 1) % 20].id,
      message:
        action === "socialize"
          ? "Good company makes a good town."
          : action === "campaign"
            ? "A little more kindness. A better tomorrow."
            : undefined,
      ...(c.id === world.mayor
        ? {
            policy: {
              tax: 0.1,
              priority:
                world.food < 150
                  ? ("food" as const)
                  : ("infrastructure" as const),
            },
          }
        : {}),
    };
  });
}
export function advanceWorld(
  previous: World,
  decisions: Decision[] = fallbackDecisions(previous),
  now = new Date().toISOString(),
): World {
  const w: World = structuredClone(previous);
  w.tick++;
  w.updatedAt = now;
  const addEvent = (
    text: string,
    type: "life" | "election" | "world" | "system" = "life",
  ) =>
    w.events.unshift({
      id: `${w.tick}-${w.events.length}`,
      tick: w.tick,
      type,
      text,
    });
  const remember = (c: Citizen, message: string) => {
    c.memories = [message, ...c.memories].slice(0, 8);
  };
  const defaults = fallbackDecisions(previous);
  for (const [i, c] of w.citizens.entries()) {
    const decision = decisions.find((d) => d.citizenId === c.id) ?? defaults[i];
    c.previousPosition = [...c.position];
    c.action = decision.action;
    c.target = decision.target;
    c.energy = clamp(c.energy - 6);
    c.hunger = clamp(c.hunger + 7);
    c.message =
      decision.message?.slice(0, 100) ??
      {
        work: "Making something that matters.",
        farm: "Look at those little sprouts!",
        build: "One beam closer to our library.",
        trade: "Something for everyone.",
        rest: "Home, sweet home.",
        socialize: "How is your day going?",
        steal: "Nobody saw that…",
        protest: "Our voices deserve to be heard.",
        campaign: "Let’s grow a better town.",
        alliance: "We’re stronger together.",
        help: "A little help goes a long way.",
      }[c.action];
    let dest = "market";
    const other = w.citizens.find(
      (x) => x.id === decision.target && x.id !== c.id,
    );
    const relate = (amount: number) => {
      if (!other) return;
      c.relationships[other.id] = clamp(
        (c.relationships[other.id] ?? 0) + amount,
        -100,
        100,
      );
      other.relationships[c.id] = clamp(
        (other.relationships[c.id] ?? 0) + amount,
        -100,
        100,
      );
    };
    switch (c.action) {
      case "farm":
        dest = "farm";
        w.food += w.priority === "food" ? 23 : 18;
        c.wealth += 3;
        break;
      case "work":
        dest =
          c.job === "Woodcutter"
            ? "forest"
            : c.job === "Farmer"
              ? "farm"
              : "market";
        c.wealth += 7 * (1 - w.tax);
        w.gold += 7 * w.tax;
        if (dest === "forest") w.wood += 9;
        else if (dest === "farm") w.food += 14;
        break;
      case "build":
        dest = "construction";
        if (w.wood >= 4 && w.gold >= 3) {
          w.construction = clamp(
            w.construction + (w.priority === "infrastructure" ? 3 : 2),
          );
          w.wood -= 4;
          w.gold -= 3;
          c.wealth += 4;
        }
        break;
      case "trade":
        if (c.wealth >= 3 && w.food >= 3) {
          c.wealth -= 3;
          w.gold += 3;
          w.food -= 3;
          c.hunger = clamp(c.hunger - 20);
        }
        break;
      case "rest":
        dest = c.home;
        c.energy = clamp(c.energy + 33);
        if (w.food >= 2) {
          w.food -= 2;
          c.hunger = clamp(c.hunger - 30);
        }
        c.happiness = clamp(c.happiness + 4);
        break;
      case "socialize":
      case "alliance":
      case "help":
        dest = "fountain";
        relate(c.action === "alliance" ? 16 : 10);
        c.happiness = clamp(c.happiness + 8);
        if (other) {
          if (c.action === "help" && c.wealth >= 3) {
            c.wealth -= 3;
            other.wealth += 3;
          }
          remember(
            c,
            `${c.action === "help" ? "Helped" : "Connected with"} ${other.name} on day ${dayOf(w)}.`,
          );
          remember(
            other,
            `${c.name} ${c.action === "help" ? "offered a gift" : "shared a friendly moment"}.`,
          );
          addEvent(
            `${c.name} and ${other.name} ${c.action === "alliance" ? "formed an alliance" : c.action === "help" ? "shared a little kindness" : "caught up at the square"}.`,
          );
        }
        break;
      case "steal":
        dest = "market";
        if (other && other.wealth >= 4) {
          c.wealth += 4;
          other.wealth -= 4;
          relate(-25);
          remember(other, `${c.name} stole 4 gold from me.`);
          remember(c, `Stole from ${other.name}; trust was lost.`);
          addEvent(`${other.name} caught ${c.name} taking their gold.`);
        }
        break;
      case "protest":
        dest = "hall";
        c.happiness = clamp(c.happiness + 2);
        w.gold = Math.max(0, w.gold - 1);
        addEvent(`${c.name} called for change outside Town Hall.`);
        break;
      case "campaign":
        dest = "hall";
        if (!w.candidates.includes(c.id)) w.candidates.push(c.id);
        c.happiness = clamp(c.happiness + 2);
        break;
    }
    if (decision.policy && c.id === w.mayor) {
      w.tax = clamp(decision.policy.tax, 0, 0.25);
      w.priority = decision.policy.priority;
    }
    c.happiness = clamp(
      c.happiness - (c.hunger > 70 ? 6 : 0) - (c.energy < 20 ? 3 : 0),
    );
    const p = buildings.find((b) => b.id === dest)!.position;
    c.position = [
      p[0] + ((i % 5) - 2) * 0.65,
      p[1] + 2 + Math.floor(i / 5) * 0.5,
    ] as Point;
  }
  // Social partners meet in the same square, so the rendered interaction has a real destination.
  for (const c of w.citizens)
    if (["socialize", "alliance", "help"].includes(c.action)) {
      const other = w.citizens.find((x) => x.id === c.target);
      if (other && !["socialize", "alliance", "help"].includes(other.action))
        other.position = [c.position[0] + 1, c.position[1]];
    }
  if (w.tick % 60 === 0) {
    const candidates = w.candidates.length
      ? w.candidates
      : w.citizens.map((c) => c.id);
    const votes: Record<string, number> = Object.fromEntries(
      candidates.map((id) => [id, 0]),
    );
    for (const voter of w.citizens) {
      const ranked = candidates
        .map((id) => ({
          id,
          score:
            (voter.relationships[id] ?? 0) +
            w.citizens.find((c) => c.id === id)!.happiness * 0.3 +
            ((Number(id.split("-")[1]) * 17 +
              Number(voter.id.split("-")[1]) * 11 +
              w.tick) %
              23),
        }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      votes[ranked[0].id]++;
    }
    w.mayor = Object.keys(votes).sort(
      (a, b) => votes[b] - votes[a] || a.localeCompare(b),
    )[0];
    const winner = w.citizens.find((c) => c.id === w.mayor)!;
    w.elections.unshift({ day: dayOf(w), winner: winner.id, votes });
    w.elections = w.elections.slice(0, 10);
    w.candidates = [];
    addEvent(
      `${winner.name} was elected mayor with ${votes[winner.id]} of 20 votes. A new chapter!`,
      "election",
    );
    for (const c of w.citizens)
      remember(c, `${winner.name} became mayor on day ${dayOf(w)}.`);
  }
  if (w.tick % 17 === 0) {
    w.food += 35;
    addEvent("A gentle rain brought a wonderful harvest. +35 food.", "world");
  }
  if (previous.construction < 100 && w.construction === 100)
    addEvent(
      "The new library is complete. A little place for big ideas.",
      "world",
    );
  if (w.tick % 6 === 0) {
    const allocation = Math.min(w.food, w.priority === "food" ? 30 : 20);
    w.food -= allocation;
    for (const c of w.citizens) {
      c.hunger = clamp(c.hunger - allocation / 2);
      if (w.priority === "wellbeing") c.happiness = clamp(c.happiness + 4);
    }
  }
  w.events = w.events.slice(0, 60);
  return w;
}
