import type { World } from "./types.js";
export function movementProgress(
  world: Pick<World, "updatedAt" | "paused" | "pausedAt" | "speed">,
  now = Date.now(),
) {
  const start = Date.parse(world.updatedAt),
    duration = 12000 / world.speed;
  // Older paused saves have no timestamp; display their authoritative destination.
  const at = world.paused
    ? world.pausedAt
      ? Date.parse(world.pausedAt)
      : start + duration
    : now;
  return Math.min(1, Math.max(0, (at - start) / duration));
}
export function setPlayback(
  w: World,
  paused: boolean,
  now = new Date().toISOString(),
) {
  if (paused && !w.paused) w.pausedAt = now;
  if (!paused && w.paused && w.pausedAt) {
    const delay = Math.max(0, Date.parse(now) - Date.parse(w.pausedAt));
    w.updatedAt = new Date(Date.parse(w.updatedAt) + delay).toISOString();
  }
  w.paused = paused;
  if (!paused) delete w.pausedAt;
}
