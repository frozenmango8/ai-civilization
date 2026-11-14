export {};
// Read-only deployment smoke check. Never sends operator/provider secrets or triggers a paid tick.
const target = process.env.DEPLOYMENT_URL;
if (!target)
  throw new Error("Set DEPLOYMENT_URL to your production HTTPS origin.");
const url = new URL(target);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== "/"
)
  throw new Error(
    "DEPLOYMENT_URL must be a plain HTTPS origin without credentials or a path.",
  );
const get = (path: string, init?: RequestInit) =>
  fetch(new URL(path, url), {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
const page = await get("/");
if (!page.ok || !(await page.text()).includes('id="root"'))
  throw new Error(
    "Production frontend did not respond with the application HTML.",
  );
const health = await get("/api/health");
const healthy = await health.json();
if (!health.ok || healthy.ok !== true || healthy.storage !== "postgres")
  throw new Error("Production API/database readiness check failed.");
const snapshots = await Promise.all([
  get("/api/world").then((r) => r.json()),
  get("/api/world").then((r) => r.json()),
]);
for (const s of snapshots)
  if (s.storage !== "postgres" || s.world?.citizens?.length !== 20)
    throw new Error("Production world is not backed by a shared database.");
if (snapshots[0].world.tick !== snapshots[1].world.tick)
  console.log(
    "A scheduler tick occurred between the visitor requests; compare again during a quiet interval.",
  );
else if (
  JSON.stringify(snapshots[0].world) !== JSON.stringify(snapshots[1].world)
)
  throw new Error("Visitors read inconsistent state at the same tick.");
if (
  (await get("/api/tick")).status !== 401 ||
  (
    await get("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"action":"pause"}',
    })
  ).status !== 401
)
  throw new Error(
    "Mutation endpoints did not reject unauthenticated requests.",
  );
console.log(
  "PASS: production HTML, database readiness, two shared-world reads, and mutation authentication.",
);
console.log(
  "Still required: actual production WebGL/browser checks, paid provider compatibility, and no-visitor scheduler progression (see README).",
);
