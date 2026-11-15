import type { Citizen, CitizenWriting, Decision, World } from "./types.js";
export const writingActions = [
  "reflect",
  "publish",
  "propose",
  "discuss",
  "vote",
];
export function preferredPriority(c: Citizen, w: World): World["priority"] {
  if (w.food < 120 || c.hunger > 55 || c.job === "Farmer" || c.job === "Baker")
    return "food";
  if (c.happiness < 60 || c.personality.includes("kind") || c.job === "Healer")
    return "wellbeing";
  return w.construction < 100 ? "infrastructure" : "wellbeing";
}
export function writingDecision(
  c: Citizen,
  w: World,
  action: Decision["action"],
  referenceId?: string,
): Decision {
  const priority = preferredPriority(c, w),
    proposal = w.proposals?.find((p) => p.id === referenceId);
  const stance = proposal
    ? proposal.priority === priority ||
      (c.relationships[proposal.authorId] ?? 0) > 30
      ? "yes"
      : "no"
    : null;
  const neighbor = w.citizens
    .filter((p) => p.id !== c.id)
    .sort(
      (a, b) => (c.relationships[b.id] ?? 0) - (c.relationships[a.id] ?? 0),
    )[0];
  const latest =
    c.memories.find(
      (m) => !/^(Wrote in my journal|Published|Proposed|Commented on)/.test(m),
    ) ?? "I am still finding my place here.";
  const title =
    action === "propose"
      ? {
          food: "Nobody should go hungry",
          infrastructure: "A library for our future",
          wellbeing: "A town that looks after its own",
        }[priority]
      : action === "reflect"
        ? `Day ${Math.floor(w.tick / 6) + 1}: ${c.name}’s notebook`
        : action === "publish"
          ? `${c.name}: a small thing worth remembering`
          : `On ${proposal?.title ?? "our shared future"}`;
  const body =
    action === "propose"
      ? {
          food: "I propose that we put food first for the next two town days. A full pantry gives everyone the freedom to do something besides worry. Please vote, even if you disagree.",
          infrastructure:
            "Let’s prioritize construction for two town days. I want a library that belongs to all of us, not another promise left unfinished.",
          wellbeing:
            "I propose two town days focused on wellbeing. Friends, rest, and a little generosity are worth more than an impressive treasury.",
        }[priority]
      : action === "vote" || action === "discuss"
        ? `I ${stance === "yes" ? "support" : "oppose"} this proposal. ${stance === "yes" ? "It addresses something I think this town needs." : "I would rather see us prioritize " + priority + "."} ${latest}`
        : action === "reflect"
          ? `I’m ${c.name}, the town’s ${c.job.toLowerCase()}. ${latest} ${c.happiness < 50 ? "I don’t feel settled here yet. I want things to change." : `I keep thinking about ${neighbor.name}. The small things between neighbors add up.`} Tomorrow I want to make a little more room for ${priority === "food" ? "security" : priority === "wellbeing" ? "kindness" : "possibility"}.`
          : `${latest} It made me think about what kind of place we are building. As a ${c.job.toLowerCase()}, I notice ${priority === "food" ? "how quickly a full pantry can become an empty one" : priority === "wellbeing" ? "whether people stop and listen to each other" : "every unfinished beam and every promise to finish it"}. What do the rest of you think?`;
  return {
    citizenId: c.id,
    action,
    target: neighbor.id,
    message:
      action === "vote"
        ? `I vote ${stance ?? "no"} on the proposal.`
        : action === "propose"
          ? title
          : action === "reflect"
            ? "Putting today into words."
            : "I have something to share.",
    writing: {
      title,
      body: body.slice(0, 500),
      referenceId: referenceId ?? null,
      stance,
      priority: action === "propose" ? priority : null,
    },
  };
}
export function recordSocialAction(
  w: World,
  c: Citizen,
  d: Decision,
): { summary: string; dest: string } {
  w.writings ??= [];
  w.proposals ??= [];
  const generated = writingDecision(
    c,
    w,
    d.action,
    d.writing?.referenceId ?? undefined,
  );
  const writing = d.writing ?? generated.writing!;
  const reference = w.proposals.find(
    (p) => p.id === writing.referenceId && p.status === "open",
  );
  const fallback = () => ({
    summary: `${c.name} found no open proposal to respond to.`,
    dest: "hall",
  });
  if (["discuss", "vote"].includes(d.action) && !reference) return fallback();
  if (d.action === "vote") {
    if (reference!.votes[c.id])
      return {
        summary: `${c.name} already voted on “${reference!.title}”.`,
        dest: "hall",
      };
    if (writing.stance !== "yes" && writing.stance !== "no")
      return {
        summary: `${c.name} abstained from the proposal.`,
        dest: "hall",
      };
    reference!.votes[c.id] = writing.stance;
    c.memories = [
      `Voted ${writing.stance} on “${reference!.title}”.`,
      ...c.memories,
    ].slice(0, 8);
    w.events.unshift({
      id: `vote-${w.tick}-${c.id}`,
      tick: w.tick,
      type: "life",
      text: `${c.name} voted ${writing.stance} on “${reference!.title}”.`,
      citizenId: c.id,
      relatedCitizenId: reference!.authorId,
    });
    return {
      summary: `${c.name} voted ${writing.stance} on “${reference!.title}”.`,
      dest: "hall",
    };
  }
  if (
    d.action === "propose" &&
    w.proposals.filter((p) => p.status === "open").length >= 5
  )
    return {
      summary: `${c.name} waited: five proposals are already being debated.`,
      dest: "hall",
    };
  const id = `writing-${w.tick}-${c.id}`;
  const entry: CitizenWriting = {
    id,
    authorId: c.id,
    kind:
      d.action === "reflect"
        ? "diary"
        : d.action === "publish"
          ? "post"
          : d.action === "propose"
            ? "proposal"
            : "comment",
    title: writing.title.slice(0, 80),
    body: writing.body.slice(0, 500),
    tick: w.tick,
    source: "demo",
    ...(reference ? { referenceId: reference.id } : {}),
  };
  if (d.action === "propose") {
    const priority = writing.priority ?? preferredPriority(c, w);
    w.proposals.unshift({
      id,
      authorId: c.id,
      title: entry.title,
      body: entry.body,
      priority,
      tick: w.tick,
      closesAt: w.tick + 5,
      status: "open",
      votes: {},
    });
  }
  if (d.action === "discuss" && reference) {
    const other = w.citizens.find((p) => p.id === reference.authorId);
    if (other && other.id !== c.id) {
      const delta =
        writing.stance === "yes" ? 3 : writing.stance === "no" ? -2 : 0;
      c.relationships[other.id] = Math.max(
        -100,
        Math.min(100, (c.relationships[other.id] ?? 0) + delta),
      );
    }
  }
  w.writings.unshift(entry);
  // Five retained pieces per author, with a global cap. No unbounded diary prompt growth.
  const counts = new Map<string, number>();
  w.writings = w.writings
    .filter((e) => {
      const n = (counts.get(e.authorId) ?? 0) + 1;
      counts.set(e.authorId, n);
      return n <= 5;
    })
    .slice(0, 100);
  c.memories = [
    `${entry.kind === "diary" ? "Wrote in my journal" : entry.kind === "proposal" ? "Proposed" : entry.kind === "comment" ? "Commented on" : "Published"} “${entry.title}”.`,
    ...c.memories,
  ].slice(0, 8);
  c.happiness = Math.min(100, c.happiness + (d.action === "reflect" ? 3 : 2));
  if (d.action === "reflect") c.energy = Math.min(100, c.energy + 8);
  w.events.unshift({
    id,
    tick: w.tick,
    type: "life",
    text: `${c.name} ${entry.kind === "diary" ? "wrote a journal entry" : entry.kind === "post" ? "published a post" : entry.kind === "proposal" ? "put a proposal before the town" : "joined the discussion"}: “${entry.title}”.`,
    citizenId: c.id,
    ...(reference ? { relatedCitizenId: reference.authorId } : {}),
  });
  return {
    summary: `${c.name} ${entry.kind === "diary" ? "reflected in their journal" : entry.kind === "post" ? "published a public post" : entry.kind === "proposal" ? "proposed a policy for the town" : "commented on a proposal"}: “${entry.title}”.`,
    dest: ["reflect", "publish"].includes(d.action) ? c.home : "hall",
  };
}
export function resolveProposals(w: World) {
  for (const p of w.proposals ?? []) {
    if (p.status !== "open" || w.tick < p.closesAt) continue;
    const yes = Object.values(p.votes).filter((v) => v === "yes").length,
      no = Object.values(p.votes).filter((v) => v === "no").length;
    p.status = yes + no >= 8 && yes > no ? "passed" : "rejected";
    if (p.status === "passed") {
      w.priority = p.priority;
      w.mandate = {
        priority: p.priority,
        until: w.tick + 12,
        proposalId: p.id,
      };
      w.celebrationTick = w.tick;
    }
    const text = `“${p.title}” ${p.status}: ${yes} yes, ${no} no.${p.status === "passed" ? ` ${p.priority} is now the town’s priority for two days.` : yes + no < 8 ? " At least eight citizens needed to vote." : " It did not win a majority."}`;
    w.events.unshift({
      id: `resolution-${p.id}`,
      tick: w.tick,
      type: "world",
      text,
      citizenId: p.authorId,
    });
    for (const c of w.citizens) c.memories = [text, ...c.memories].slice(0, 8);
  }
  w.proposals = (w.proposals ?? [])
    .filter((p) => p.status === "open" || w.tick - p.closesAt < 60)
    .slice(0, 20);
}
