import { buildings, names } from "./map.js";
import type { Citizen, Decision, Point, World } from "./types.js";
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
          : world.challenge?.status === "active" && (i + world.tick) % 4 === 0
            ? world.challenge.kind === "repair"
              ? "build"
              : world.challenge.kind === "harvest"
                ? "farm"
                : "help"
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
    citizenId?: string,
    relatedCitizenId?: string,
  ) =>
    w.events.unshift({
      id: `${w.tick}-${w.events.length}`,
      tick: w.tick,
      type,
      text,
      citizenId,
      relatedCitizenId,
    });
  const remember = (c: Citizen, message: string) => {
    c.memories = [message, ...c.memories].slice(0, 8);
  };
  w.lastTick = {
    tick: w.tick,
    food: 0,
    gold: 0,
    wood: 0,
    construction: 0,
    happiness: 0,
    decisions: [],
    providers: {
      terra: { status: "demo", detail: "Free simulation" },
      sonnet: { status: "demo", detail: "Free simulation" },
    },
  };
  const defaults = fallbackDecisions(previous);
  for (const [i, c] of w.citizens.entries()) {
    const decision = decisions.find((d) => d.citizenId === c.id) ?? defaults[i];
    c.playerDirected = false;
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
    const before = {
      food: w.food,
      wood: w.wood,
      construction: w.construction,
      wealth: c.wealth,
      energy: c.energy,
      happiness: c.happiness,
    };
    let outcome = "";
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
        w.food +=
          (w.priority === "food" ? 23 : 18) +
          (w.upgrades?.includes("farm") ? 6 : 0);
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
        if (
          (w.construction < 100 ||
            (w.challenge?.status === "active" &&
              w.challenge.kind === "repair")) &&
          w.wood >= 4 &&
          w.gold >= 3
        ) {
          if (
            w.challenge?.status === "active" &&
            w.challenge.kind === "repair"
          ) {
            dest = "market";
            outcome = `${c.name} repaired the market stalls. One repair closer to reopening.`;
          } else
            w.construction = clamp(
              w.construction + (w.priority === "infrastructure" ? 3 : 2),
            );
          w.wood -= 4;
          w.gold -= 3;
          c.wealth += 4;
        }
        break;
      case "trade":
        if (w.challenge?.status === "active" && w.challenge.kind === "repair") {
          outcome = `${c.name} found the market closed. Builders need to repair the stalls.`;
          break;
        }
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
            `${c.name} and ${other.name} ${c.action === "alliance" ? "formed an alliance" : c.action === "help" ? "shared a little kindness" : "stopped to catch up"}.`,
            "life",
            c.id,
            other.id,
          );
        }
        if (other)
          outcome = `${c.name} ${c.action === "alliance" ? "made an alliance with" : c.action === "help" ? "helped" : "caught up with"} ${other.name}.`;
        else outcome = `${c.name} looked for company at the square.`;
        break;
      case "steal":
        dest = "market";
        if (other && other.wealth >= 4) {
          const betrayed = (c.relationships[other.id] ?? 0) > 15;
          c.wealth += 4;
          other.wealth -= 4;
          relate(-25);
          remember(
            other,
            `${c.name} ${betrayed ? "betrayed my trust and stole" : "stole"} 4 gold from me.`,
          );
          remember(c, `Stole from ${other.name}; trust was lost.`);
          addEvent(
            `${other.name} caught ${c.name} taking their gold.${betrayed ? " A friendship turned into a betrayal." : ""}`,
            "life",
            c.id,
            other.id,
          );
          outcome = `${c.name} stole 4 gold from ${other.name}. Trust fell by 25.`;
        }
        break;
      case "protest":
        dest = "hall";
        c.happiness = clamp(c.happiness + 2);
        w.gold = Math.max(0, w.gold - 1);
        addEvent(
          `${c.name} called for change outside Town Hall.`,
          "life",
          c.id,
        );
        outcome = `${c.name} protested at Town Hall.`;
        break;
      case "campaign":
        dest = "hall";
        w.campaignPromises = {
          ...(w.campaignPromises ?? {}),
          [c.id]: c.message,
        };
        if (!w.candidates.includes(c.id)) {
          w.candidates.push(c.id);
          addEvent(
            `${c.name} is running for mayor: “${c.message}”`,
            "life",
            c.id,
          );
        }
        outcome = `${c.name} campaigned for mayor: “${c.message}”`;
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
    if (!outcome)
      outcome =
        c.action === "farm"
          ? `${c.name} harvested ${w.food - before.food} food at Sunfield Farm.`
          : c.action === "build"
            ? w.construction > before.construction
              ? `${c.name} built ${w.construction - before.construction}% of the library.`
              : `${c.name} could not build: ${w.construction >= 100 ? "the library is complete" : "the town needs timber or gold"}.`
            : c.action === "work"
              ? `${c.name} earned ${(c.wealth - before.wealth).toFixed(1)} gold${w.wood > before.wood ? ` and collected ${w.wood - before.wood} wood` : w.food > before.food ? ` and harvested ${w.food - before.food} food` : ""}.`
              : c.action === "rest"
                ? `${c.name} went home to recharge and eat.`
                : c.action === "trade"
                  ? c.wealth < before.wealth
                    ? `${c.name} bought a meal for 3 gold.`
                    : `${c.name} found nothing affordable at the market.`
                  : `${c.name} found nobody to steal from.`;
    w.lastTick!.decisions.push({
      citizenId: c.id,
      action: c.action,
      summary: outcome,
      message: c.message,
      source: "demo",
      contribution:
        w.challenge?.status === "active"
          ? (
              w.challenge.kind === "repair"
                ? c.action === "build" && w.wood < before.wood
                : w.challenge.kind === "harvest"
                  ? c.action === "farm"
                  : ["help", "alliance", "socialize"].includes(c.action) &&
                    !!other
            )
            ? 1
            : 0
          : 0,
    });
    const p = buildings.find((b) => b.id === dest)!.position;
    c.position = [
      p[0] + ((i % 5) - 2) * 0.65,
      p[1] + 2 + Math.floor(i / 5) * 0.5,
    ] as Point;
  }
  // Social visitors approach a busy partner instead of moving that partner away from work.
  for (const c of w.citizens)
    if (["socialize", "alliance", "help"].includes(c.action)) {
      const other = w.citizens.find((x) => x.id === c.target);
      if (other && !["socialize", "alliance", "help"].includes(other.action))
        c.position = [other.position[0] + 1, other.position[1]];
    }
  if (w.tick % 60 === 0 || w.electionRequested) {
    w.electionRequested = false;
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
    w.celebrationTick = w.tick;
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
  if (w.challenge?.status === "active") {
    const useful = w.lastTick!.decisions.reduce(
      (n, d) => n + (d.contribution ?? 0),
      0,
    );
    w.challenge.progress = Math.min(
      w.challenge.target,
      w.challenge.progress + useful,
    );
    if (w.challenge.progress >= w.challenge.target) {
      w.challenge.status = "won";
      w.gold += 45;
      w.celebrationTick = w.tick;
      for (const c of w.citizens) c.happiness = clamp(c.happiness + 5);
      addEvent(
        `${w.challenge.title}: the town pulled together! +45 gold and +5 happiness.`,
        "world",
      );
    } else if (w.tick >= w.challenge.deadline) {
      w.challenge.status = "lost";
      w.food = Math.max(0, w.food - 30);
      for (const c of w.citizens) c.happiness = clamp(c.happiness - 5);
      addEvent(
        `${w.challenge.title}: time ran out. The disruption cost 30 food and 5 happiness.`,
        "world",
      );
    }
  }
  if (w.tick % 12 === 3 && w.challenge?.status !== "active") {
    const kind = (["repair", "harvest", "unity"] as const)[
      Math.floor(w.tick / 12) % 3
    ];
    const detail = {
      repair: {
        title: "Storm at the market",
        description:
          "A storm damaged the stalls. Complete 6 building actions in 5 ticks to reopen trade.",
      },
      harvest: {
        title: "The harvest is at risk",
        description:
          "Bring in the crop before the rain. Complete 8 farming actions in 5 ticks.",
      },
      unity: {
        title: "A town divided",
        description:
          "Rivalries are growing. Complete 8 friendly interactions in 5 ticks.",
      },
    }[kind];
    w.challenge = {
      kind,
      ...detail,
      progress: 0,
      target: kind === "repair" ? 6 : 8,
      deadline: w.tick + 5,
      status: "active",
    };
    addEvent(`${detail.title}! ${detail.description}`, "world");
  }
  if (w.construction === 100 && previous.construction < 100) {
    w.celebrationTick = w.tick;
    for (const c of w.citizens) c.happiness = clamp(c.happiness + 8);
  }
  w.lastTick!.food = w.food - previous.food;
  w.lastTick!.gold = w.gold - previous.gold;
  w.lastTick!.wood = w.wood - previous.wood;
  w.lastTick!.construction = w.construction - previous.construction;
  w.lastTick!.happiness =
    w.citizens.reduce((n, c) => n + c.happiness, 0) / 20 -
    previous.citizens.reduce((n, c) => n + c.happiness, 0) / 20;
  w.events = w.events.slice(0, 60);
  return w;
}
