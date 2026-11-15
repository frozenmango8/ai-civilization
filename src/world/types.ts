export type Provider = "terra" | "sonnet";
export const actions = [
  "work",
  "farm",
  "build",
  "trade",
  "rest",
  "socialize",
  "steal",
  "protest",
  "campaign",
  "alliance",
  "help",
  "reflect",
  "publish",
  "propose",
  "discuss",
  "vote",
] as const;
export type Action = (typeof actions)[number];
export type Point = [number, number];
export interface Citizen {
  id: string;
  name: string;
  provider: Provider;
  job: string;
  personality: string;
  home: string;
  color: string;
  skin: string;
  happiness: number;
  energy: number;
  wealth: number;
  hunger: number;
  memories: string[];
  relationships: Record<string, number>;
  action: Action;
  target?: string;
  position: Point;
  previousPosition: Point;
  message: string;
  playerDirected?: boolean;
}
export interface Building {
  id: string;
  name: string;
  kind:
    | "home"
    | "hall"
    | "farm"
    | "market"
    | "forest"
    | "construction"
    | "fountain";
  position: Point;
  color: string;
  owner?: string;
}
export interface TownEvent {
  id: string;
  tick: number;
  type: "life" | "election" | "world" | "system";
  text: string;
  citizenId?: string;
  relatedCitizenId?: string;
}
export interface Election {
  day: number;
  winner: string;
  votes: Record<string, number>;
}
export interface DecisionOutcome {
  citizenId: string;
  action: Action;
  summary: string;
  message?: string;
  contribution?: number;
  source: "ai" | "demo" | "fallback";
}
export interface TickReport {
  tick: number;
  food: number;
  gold: number;
  wood: number;
  construction: number;
  happiness: number;
  decisions: DecisionOutcome[];
  providers: Partial<
    Record<Provider, { status: "ai" | "demo" | "fallback"; detail: string }>
  >;
}
export interface TownChallenge {
  kind: "repair" | "harvest" | "unity";
  title: string;
  description: string;
  progress: number;
  target: number;
  deadline: number;
  status: "active" | "won" | "lost";
}
export type WritingKind = "diary" | "post" | "proposal" | "comment";
export interface CitizenWriting {
  id: string;
  authorId: string;
  kind: WritingKind;
  title: string;
  body: string;
  tick: number;
  source: "ai" | "demo" | "fallback";
  referenceId?: string;
}
export interface Proposal {
  source?: "ai" | "demo" | "fallback";
  id: string;
  authorId: string;
  title: string;
  body: string;
  priority: "food" | "infrastructure" | "wellbeing";
  tick: number;
  closesAt: number;
  status: "open" | "passed" | "rejected";
  votes: Record<string, "yes" | "no">;
}
export interface World {
  version: 1;
  tick: number;
  updatedAt: string;
  seed: number;
  mode: "demo" | "ai";
  paused: boolean;
  pausedAt?: string;
  speed: number;
  food: number;
  gold: number;
  wood: number;
  construction: number;
  tax: number;
  priority: "food" | "infrastructure" | "wellbeing";
  mayor: string;
  citizens: Citizen[];
  events: TownEvent[];
  elections: Election[];
  candidates: string[];
  lastTick?: TickReport;
  challenge?: TownChallenge;
  upgrades?: string[];
  lastFestivalTick?: number;
  celebrationTick?: number;
  electionRequested?: boolean;
  lastElectionRequestTick?: number;
  campaignPromises?: Record<string, string>;
  writings?: CitizenWriting[];
  proposals?: Proposal[];
  mandate?: { priority: World["priority"]; until: number; proposalId: string };
}
export interface Decision {
  citizenId: string;
  action: Action;
  target?: string;
  message?: string;
  policy?: { tax: number; priority: World["priority"] };
  writing?: {
    title: string;
    body: string;
    referenceId: string | null;
    stance: "yes" | "no" | null;
    priority: World["priority"] | null;
  } | null;
}
export interface Usage {
  provider: Provider;
  day: string;
  chargedTokens: number;
  actualTokens: number;
  chargedMicros: number;
  actualMicros: number;
  calls: number;
  errors: number;
}
export interface ProviderStatus {
  provider: Provider;
  configured: boolean;
  model: string | null;
  issue: string | null;
}
export interface Snapshot {
  world: World;
  storage: "postgres" | "browser";
  usage: Usage[];
  providers: ProviderStatus[];
  budgets: {
    dailyTokens: number;
    dailyUsd: number;
    providerDailyTokens: number;
    providerDailyUsd: number;
  };
}
