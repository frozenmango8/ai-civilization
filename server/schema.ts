export const schema = `
CREATE TABLE IF NOT EXISTS worlds (
 id text PRIMARY KEY CHECK (id = 'main'), state jsonb NOT NULL,
 revision bigint NOT NULL DEFAULT 0, lease_token text, lease_until timestamptz
);
CREATE TABLE IF NOT EXISTS ticks (
 id text PRIMARY KEY, status text NOT NULL CHECK (status IN ('running','done','failed')),
 revision bigint, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usage_daily (
 day date NOT NULL, provider text NOT NULL CHECK (provider IN ('terra','sonnet')),
 charged_tokens bigint NOT NULL DEFAULT 0 CHECK (charged_tokens >= 0),
 actual_tokens bigint NOT NULL DEFAULT 0 CHECK (actual_tokens >= 0),
 charged_micros bigint NOT NULL DEFAULT 0 CHECK (charged_micros >= 0),
 actual_micros bigint NOT NULL DEFAULT 0 CHECK (actual_micros >= 0),
 calls integer NOT NULL DEFAULT 0, errors integer NOT NULL DEFAULT 0,
 PRIMARY KEY (day, provider)
);
CREATE TABLE IF NOT EXISTS saves (
 id text PRIMARY KEY CHECK (id = 'manual'), state jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
`;
