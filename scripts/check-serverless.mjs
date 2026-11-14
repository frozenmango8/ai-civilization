// Load the emitted JavaScript with native Node ESM, without tsx/Vite resolution.
// Missing runtime extensions must fail here, before they crash on Vercel.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "../.vercel/runtime-check/api/[route].js";

// This smoke test intentionally requires no live credentials and never calls an AI.
delete process.env.DATABASE_URL;
const server = createServer((req, res) => {
  void handler(req, res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 503);
  assert.equal((await health.json()).code, "DATABASE_NOT_CONFIGURED");
  const world = await fetch(`${origin}/api/world`);
  assert.equal(world.status, 503);
  assert.equal((await world.json()).code, "DATABASE_NOT_CONFIGURED");
  assert.equal((await fetch(`${origin}/api/tick`)).status, 401);
  assert.equal(
    (await fetch(`${origin}/api/control`, { method: "POST" })).status,
    401,
  );
  console.log(
    "PASS: compiled serverless entry loads with native Node ESM; health/world return safe JSON and mutations require authentication.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
