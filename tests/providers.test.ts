import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../server/providers.js";
import { createWorld } from "../src/world/engine.js";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
for (const provider of ["terra", "sonnet"] as const)
  test(`${provider} uses its exact configured model, structured output and reported usage`, async () => {
    const prefix = provider === "terra" ? "OPENAI" : "ANTHROPIC";
    process.env[`${prefix}_MODEL`] = `${provider}-exact-test-id`;
    process.env[`${prefix}_API_KEY`] = "server-only-test-key";
    const w = createWorld();
    const decisions = w.citizens
      .filter((c) => c.provider === provider)
      .map((c) => ({
        citizenId: c.id,
        action: "rest",
        message: "Home sweet home",
        target: null,
        policy: null,
      }));
    globalThis.fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, `${provider}-exact-test-id`);
      assert.equal(
        new Headers(init?.headers).get(
          provider === "terra" ? "Authorization" : "x-api-key",
        ),
        provider === "terra"
          ? "Bearer server-only-test-key"
          : "server-only-test-key",
      );
      assert.ok(
        String(input).startsWith(
          provider === "terra"
            ? "https://api.openai.com/"
            : "https://api.anthropic.com/",
        ),
      );
      const format =
        provider === "terra" ? body.text.format : body.output_config.format;
      assert.equal(format.type, "json_schema");
      assert.equal(format.schema.additionalProperties, false);
      assert.ok(!JSON.stringify(format.schema).includes("maxLength"));
      return Response.json({
        usage: { input_tokens: 120, output_tokens: 220 },
        ...(provider === "terra"
          ? {
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify({ decisions }),
                    },
                  ],
                },
              ],
            }
          : {
              content: [{ type: "text", text: JSON.stringify({ decisions }) }],
            }),
      });
    };
    const result = await decide(provider, w, "test prompt");
    assert.equal(result.decisions.length, 10);
    assert.equal(result.inputTokens, 120);
    assert.equal(result.outputTokens, 220);
  });
test("provider HTTP failures are sanitized; no response body is relayed", async () => {
  globalThis.fetch = async () =>
    new Response("sensitive provider response", { status: 403 });
  await assert.rejects(
    () => decide("terra", createWorld(), "prompt"),
    (e: Error) => e.message === "PROVIDER_HTTP_403",
  );
});
test("unreported token usage and invalid JSON never become decisions", async () => {
  globalThis.fetch = async () => Response.json({ output: [] });
  await assert.rejects(
    () => decide("terra", createWorld(), "prompt"),
    /INVALID_USAGE/,
  );
  globalThis.fetch = async () =>
    Response.json({
      usage: { input_tokens: 1, output_tokens: 2 },
      output: [{ content: [{ type: "output_text", text: "not json" }] }],
    });
  await assert.rejects(() => decide("terra", createWorld(), "prompt"));
});
