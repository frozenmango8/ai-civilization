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
}
export interface Election {
  day: number;
  winner: string;
  votes: Record<string, number>;
}
export interface World {
  version: 1;
  tick: number;
  updatedAt: string;
  seed: number;
  mode: "demo" | "ai";
  paused: boolean;
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
}
export interface Decision {
  citizenId: string;
  action: Action;
  target?: string;
  message?: string;
  policy?: { tax: number; priority: World["priority"] };
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
