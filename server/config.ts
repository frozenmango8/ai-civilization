import type { Provider, ProviderStatus } from "../src/world/types";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function number(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0)
    throw new HttpError(
      503,
      "INVALID_CONFIGURATION",
      `${name} must be a nonnegative number.`,
    );
  return value;
}
export function budgets() {
  return {
    dailyTokens: number("DAILY_TOKEN_BUDGET", 200000),
    dailyUsd: number("DAILY_USD_BUDGET", 5),
    providerDailyTokens: number("PROVIDER_DAILY_TOKEN_BUDGET", 100000),
    providerDailyUsd: number("PROVIDER_DAILY_USD_BUDGET", 2),
  };
}
export function providerConfig(provider: Provider) {
  const prefix = provider === "terra" ? "OPENAI" : "ANTHROPIC";
  return {
    model: process.env[`${prefix}_MODEL`] || "",
    key: process.env[`${prefix}_API_KEY`] || "",
    inputRate: number(`${prefix}_INPUT_USD_PER_MILLION`, 0),
    outputRate: number(`${prefix}_OUTPUT_USD_PER_MILLION`, 0),
  };
}
export function providerStatuses(): ProviderStatus[] {
  return (["terra", "sonnet"] as const).map((provider) => {
    const c = providerConfig(provider);
    const issue = !c.model
      ? "Set an exact API model ID; no model is substituted."
      : !c.key
        ? "Provider API key is missing."
        : !c.inputRate || !c.outputRate
          ? "Set positive input and output pricing for cost protection."
          : null;
    return {
      provider,
      configured: issue === null,
      model: c.model || null,
      issue,
    };
  });
}
