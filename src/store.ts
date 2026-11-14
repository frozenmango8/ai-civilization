import { applyProject } from "./world/projects";
import { create } from "zustand";
import type { Snapshot, World } from "./world/types";
import { advanceWorld, createWorld } from "./world/engine";
const localKey = "little-civilization-demo-v1";
function localWorld(): World {
  try {
    const v = JSON.parse(localStorage.getItem(localKey) || "null");
    if (
      v?.version === 1 &&
      v.citizens?.length === 20 &&
      Number.isSafeInteger(v.tick)
    )
      return v;
  } catch {
    /* a corrupt local save is disposable */
  }
  return advanceWorld(createWorld());
}
interface Store {
  world: World;
  snapshot: Snapshot | null;
  storage: "connecting" | "browser" | "postgres";
  error: string | null;
  selected: string | null;
  following: string | null;
  cinematic: boolean;
  cameraReset: number;
  busy: boolean;
  admin: string;
  setAdmin: (value: string) => void;
  select: (id: string | null) => void;
  follow: (id: string | null) => void;
  resetCamera: () => void;
  setCinematic: (value: boolean) => void;
  refresh: () => Promise<void>;
  command: (action: string, value?: string | number) => Promise<void>;
  step: () => Promise<void>;
}
let pollInFlight = false;
async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "The town could not be reached.");
  return data;
}
export const useTown = create<Store>((set, get) => ({
  world: localWorld(),
  snapshot: null,
  storage: "connecting",
  error: null,
  selected: null,
  following: null,
  cinematic: false,
  cameraReset: 0,
  busy: false,
  admin: "",
  setAdmin: (admin) => set({ admin }),
  select: (selected) => set({ selected }),
  follow: (following) => set({ following, cinematic: false }),
  resetCamera: () =>
    set((s) => ({
      cameraReset: s.cameraReset + 1,
      following: null,
      cinematic: false,
    })),
  setCinematic: (cinematic) => set({ cinematic, following: null }),
  refresh: async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const snapshot: Snapshot = await request("/api/world");
      set({
        snapshot,
        world: snapshot.world,
        storage: "postgres",
        error: null,
      });
    } catch (e) {
      set((s) => ({
        storage: s.storage === "postgres" ? "postgres" : "browser",
        error:
          s.storage === "postgres"
            ? "Connection interrupted. Showing the last shared state; retrying automatically."
            : "Private demo · stored in this browser. Connect Postgres for a shared town.",
      }));
    } finally {
      pollInFlight = false;
    }
  },
  command: async (action, value) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      if (get().storage === "postgres") {
        const snapshot = await request("/api/control", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${get().admin}`,
          },
          body: JSON.stringify({ action, value }),
        });
        set({ snapshot, world: snapshot.world, error: null });
      } else {
        let world = structuredClone(get().world);
        if (action === "project") world = applyProject(world, value);
        if (action === "play") world.paused = false;
        if (action === "pause") world.paused = true;
        if (action === "speed") world.speed = Number(value);
        if (action === "mode" && value === "ai")
          throw new Error(
            "Real AI requires Postgres and server-side provider configuration.",
          );
        if (action === "save")
          localStorage.setItem(`${localKey}-snapshot`, JSON.stringify(world));
        if (action === "load") {
          const save = localStorage.getItem(`${localKey}-snapshot`);
          if (!save) throw new Error("Save a town snapshot first.");
          const loaded = JSON.parse(save);
          loaded.updatedAt = new Date().toISOString();
          loaded.paused = true;
          set({ world: loaded });
          localStorage.setItem(localKey, JSON.stringify(loaded));
          return;
        }
        set({ world, error: null });
        localStorage.setItem(localKey, JSON.stringify(world));
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "The operation failed." });
    } finally {
      set({ busy: false });
    }
  },
  step: async () => {
    if (get().busy) return;
    set({ busy: true });
    try {
      if (get().storage === "postgres") {
        const key = `${Date.now()}:${crypto.randomUUID()}`;
        const snapshot: Snapshot = await request("/api/tick", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${get().admin}`,
            "Idempotency-Key": key,
          },
        });
        set({ snapshot, world: snapshot.world, error: null });
      } else {
        const world = advanceWorld(get().world);
        set({ world, error: null });
        localStorage.setItem(localKey, JSON.stringify(world));
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Tick failed." });
    } finally {
      set({ busy: false });
    }
  },
}));
// Shared worlds are advanced by the scheduler, never by visitor polling.
export function startSync() {
  void useTown.getState().refresh();
  const poll = setInterval(() => {
    void useTown.getState().refresh();
  }, 8000);
  const localTick = setInterval(() => {
    const s = useTown.getState();
    if (
      s.storage === "browser" &&
      !s.world.paused &&
      Date.now() - Date.parse(s.world.updatedAt) >= 60000
    )
      void s.step();
  }, 1000);
  return () => {
    clearInterval(poll);
    clearInterval(localTick);
  };
}
