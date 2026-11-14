import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { database } from "./db";
import { HttpError } from "./config";
import { Simulation } from "./service";
export function authorized(
  value: string | undefined,
  secret: string | undefined,
) {
  if (!secret || secret.length < 24 || !value) return false;
  const a = Buffer.from(value),
    b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
const control = z
  .object({
    action: z.enum(["pause", "play", "mode", "speed", "save", "load"]),
    value: z.union([z.string().max(20), z.number()]).optional(),
  })
  .strict();
async function readBody(req: IncomingMessage & { body?: unknown }) {
  if (req.body)
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2048)
      throw new HttpError(413, "BODY_TOO_LARGE", "Request is too large.");
  }
  return JSON.parse(text || "{}");
}
export async function handle(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  injected?: Simulation,
) {
  const send = (status: number, value: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const url = new URL(req.url ?? "/", "http://internal"),
      path = url.pathname;
    if (path === "/api/health" && req.method === "GET") {
      if (!process.env.DATABASE_URL && !injected)
        return send(503, {
          ok: false,
          code: "DATABASE_NOT_CONFIGURED",
          message:
            "Connect Postgres and run npm run db:migrate. A private browser demo is available.",
        });
      const snapshot = await (
        injected ?? new Simulation(database())
      ).snapshot();
      return send(200, {
        ok: true,
        storage: snapshot.storage,
        tick: snapshot.world.tick,
      });
    }
    if (!["/api/world", "/api/tick", "/api/control"].includes(path))
      throw new HttpError(404, "NOT_FOUND", "API route not found.");
    const expected =
      path === "/api/world"
        ? ["GET"]
        : path === "/api/tick"
          ? ["GET", "POST"]
          : ["POST"];
    if (!expected.includes(req.method ?? "")) {
      res.setHeader("Allow", expected.join(", "));
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    if (path !== "/api/world") {
      const cron = req.method === "GET";
      if (
        !authorized(
          req.headers.authorization,
          cron ? process.env.CRON_SECRET : process.env.ADMIN_SECRET,
        )
      )
        throw new HttpError(
          401,
          "UNAUTHORIZED",
          "A valid server-configured operator or scheduler secret is required.",
        );
    }
    if (!process.env.DATABASE_URL && !injected)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Connect Postgres and run npm run db:migrate. A private browser demo is available.",
      );
    const service = injected ?? new Simulation(database());
    if (path === "/api/world") return send(200, await service.snapshot());
    if (path === "/api/control")
      return send(
        200,
        await service.control(control.parse(await readBody(req))),
      );
    const scheduled = req.method === "GET";
    const date = new Date();
    let id = `cron:${date.toISOString().slice(0, 16)}`;
    if (!scheduled) {
      const key = req.headers["idempotency-key"];
      if (
        typeof key !== "string" ||
        !/^\d{13}:[\da-f-]{36}$/.test(key) ||
        Math.abs(Date.now() - Number(key.slice(0, 13))) > 86400000
      )
        throw new HttpError(
          400,
          "INVALID_IDEMPOTENCY_KEY",
          "Send Idempotency-Key as a current millisecond timestamp, colon, and UUID. Reuse it for retries.",
        );
      id = `manual:${key}`;
    }
    return send(200, await service.tick(id, scheduled));
  } catch (e) {
    if (e instanceof HttpError)
      return send(e.status, { code: e.code, message: e.message });
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return send(400, {
        code: "INVALID_REQUEST",
        message: "Request body did not match the API schema.",
      });
    // No raw exceptions, SQL connection strings, provider bodies or headers reach logs/responses.
    return send(503, {
      code: "SERVICE_UNAVAILABLE",
      message:
        "The database or simulation is unavailable. Check database connectivity and migrations.",
    });
  }
}
