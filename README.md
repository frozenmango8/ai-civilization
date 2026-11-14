# Little Civilization

A small world with a life of its own. Twenty citizens live in an original low-poly 3D town, make decisions, build friendships, collect resources, and elect a mayor. Ten citizens belong to **Terra**, ten to **Sonnet**; their provider does not determine their personality or behavior.

Built from an empty repository: there was no existing Express backend or provider integration to migrate. The framework uses React, TypeScript, Vite, React Three Fiber, Drei, Zustand, Tailwind, Node serverless functions, and Postgres. All art is procedural geometry; no external assets or fonts are required.

**Validation:** local build, simulation, database, serverless startup, and browser checks are included. Complete the production checklist for your own Vercel deployment; local tests do not establish live provider or scheduler readiness.

## What you can do

- Explore a complete 3D town: twenty cottages, a clock-tower hall, farms, market stalls, forest, library construction, fountain, connected streets, lamps, benches, flowers, hills, clouds, chimney smoke, and day/night windows.
- Watch citizens walk along streets with animated limbs and work at their destinations. Orbit, zoom, pan, reset, use cinematic orbit, or follow a citizen.
- Click citizens/buildings, or open the citizen list. Inspect needs, jobs, personal gold, memories, friends, rivals, and alliances.
- Work, farm, build, trade, rest, socialize, steal, protest, campaign, ally, and help. Relationships, theft, gifts, and elections leave persistent memories.
- Elect a mayor every 60 ticks (10 town days, six ticks/day). Every citizen casts one vote; only the mayor can set tax (0–25%) and resource priorities.
- Pause, resume, step manually, change animation speed, inspect provider usage, and save/load a snapshot. Speed controls visual travel, not paid request frequency. Loading pauses the town and never resets cost accounting.

## A town with something at stake

- **Shape the town:** spend treasury resources on a festival, a permanent farm expansion, library construction, or a snap election. Projects never make AI calls, work in the free demo, and require operator access in a shared town. Festivals and snap elections have a one-town-day cooldown. The farm can be expanded once.
- **Politics:** candidates retain their campaign promises, theft can betray a friendship, and rivalries appear on the map overlay. The town council shows the mayor, tax, candidates, and friendly connections (these are not predicted votes). A snap election gives all 20 citizens one vote on the next tick; regular elections still run every ten town days.
- **Town challenges:** starting on tick 3 and then every 12 ticks, the town faces market repairs, an urgent harvest, or a social divide. Helpful actions make progress; unfunded repairs do not count. Market damage closes trading until repaired. Success awards 45 gold and 5 happiness; failure reduces food reserves and happiness.
- **See each decision:** use **Recap** above the playback controls to see all 20 actions, messages, resource changes, and which provider decisions succeeded. Click a recap entry or a linked event to zoom into that citizen. Old saves begin recording a recap on their next tick.
- **Watch the result:** citizens carry tools, crates, or bags, finish their walk in about 12 seconds at 1× speed, and show rotating action bubbles. A farm expansion adds a greenhouse. Festivals and elections celebrate in the square.
- **Know what you paid for:** provider settings distinguish charged/reserved usage, actual settled usage, failed calls, and the latest tick’s AI/fallback result. “Configured” checks only variable presence; it is not a live credential test.

These additions are backward compatible with existing JSONB worlds and snapshots. No database migration or reset is needed. Player projects leave the AI usage ledger untouched.

## Run the free demo

Use Node 24 LTS (`nvm use` if you use nvm).

```sh
npm ci
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open the Vite address printed by the terminal. With no database, the application explicitly shows **Private demo**. It is functional, free, and saved in that browser’s local storage; it is not a shared or autonomous world. It advances once per minute while open and supports manual stepping without keys. Switching to real AI requires the server-backed world.

Vite proxies `/api` to port 3001. For local Postgres/Neon, set `DATABASE_URL`, `ADMIN_SECRET`, and other needed values in your shell or an untracked `.env`. The API reads environment variables, not Vite client variables. Node 24 supports:

```sh
node --env-file=.env --import tsx scripts/migrate.ts
node --env-file=.env --import tsx server/dev.ts
```

`npm run db:migrate` uses an already exported `DATABASE_URL`. Vite alone cannot run the production API functions.

## Deploy to Vercel, step by step

### 1. Create a persistent database

1. Create a Neon Postgres project (or another managed Postgres with TLS).
2. Copy its **pooled** connection string. Keep the supplied TLS options, e.g. `sslmode=require`. Never disable TLS verification.
3. Set `DATABASE_URL` securely in your local shell or untracked `.env`, then run:

   ```sh
   node --env-file=.env --import tsx scripts/migrate.ts
   ```

   Alternatively, export `DATABASE_URL` then run `npm run db:migrate`. The migration is transactional, repeatable, advisory-locked, and preserves existing worlds. It creates `worlds`, `ticks`, `usage_daily`, and `saves`. The first API read seeds the town atomically. No database is created at build time.

4. Use a separate Neon branch/database for preview deployments to avoid previews modifying production. A cloned branch containing a running lease recovers after 90 seconds.

### 2. Connect GitHub and Vercel

1. Commit these project files and push to your own GitHub repository.
2. In Vercel, **Add New → Project → Import Git Repository** and select it.
3. Choose the **Vite** framework, repository root as root directory, Node.js **24.x**, install command `npm ci`, build command `npm run build`, output `dist`.
4. `vercel.json` deploys the frontend and the Node function `api/[route].ts`, which handles `/api/world`, `/api/health`, `/api/tick`, and `/api/control`. No Express process, VM, filesystem state, or separate backend hosting is needed. `maxDuration` is 60 seconds; each provider request has a 20-second timeout and both requests run concurrently.
5. In **Settings → Environment Variables**, add the values below to Production. Set preview-specific database/secret values for Preview. Redeploy after changing variables.
6. Deploy. Subsequent pushes to the configured production Git branch automatically deploy. Pull requests receive Vercel previews according to your project’s Git integration settings.

### 3. Set environment variables

Use `.env.example` as the inventory. No secrets should have a `VITE_` prefix, appear in Git, or be placed in frontend code.

| Variable                           | Required for                   | Purpose                                                         |
| ---------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `DATABASE_URL`                     | Shared world                   | Pooled Neon/Postgres connection string with TLS                 |
| `CRON_SECRET`                      | Autonomous ticks               | Random scheduler secret, at least 24 characters                 |
| `ADMIN_SECRET`                     | Shared-world operator controls | A **different** random secret, at least 24 characters           |
| `OPENAI_API_KEY`                   | Real Terra calls               | Server-side OpenAI API key                                      |
| `OPENAI_MODEL`                     | Real Terra calls               | Exact model ID available to your account                        |
| `ANTHROPIC_API_KEY`                | Real Sonnet calls              | Server-side Anthropic API key                                   |
| `ANTHROPIC_MODEL`                  | Real Sonnet calls              | Exact Sonnet API model ID available to your account             |
| `OPENAI_INPUT_USD_PER_MILLION`     | Real Terra calls               | Positive current input token price                              |
| `OPENAI_OUTPUT_USD_PER_MILLION`    | Real Terra calls               | Positive current output token price, including reasoning tokens |
| `ANTHROPIC_INPUT_USD_PER_MILLION`  | Real Sonnet calls              | Positive current input token price                              |
| `ANTHROPIC_OUTPUT_USD_PER_MILLION` | Real Sonnet calls              | Positive current output token price                             |
| `DAILY_TOKEN_BUDGET`               | Optional                       | Combined UTC daily charged-token ceiling, default 200000        |
| `DAILY_USD_BUDGET`                 | Optional                       | Combined UTC daily USD ceiling, default 5                       |
| `PROVIDER_DAILY_TOKEN_BUDGET`      | Optional                       | Each provider’s UTC daily token ceiling, default 100000         |
| `PROVIDER_DAILY_USD_BUDGET`        | Optional                       | Each provider’s UTC daily USD ceiling, default 2                |

Generate each random secret separately with `openssl rand -hex 32`, and enter it securely. Never paste credentials into chat. If your deployment restricts outbound traffic, permit `api.openai.com:443`, `api.anthropic.com:443`, and your database hostname/port (typically 5432).

“Terra” is a citizen faction label, **not a verified public OpenAI model ID**. We do not invent an ID or silently use another model. Supply the exact ID you intend; both configured models must support structured JSON output. Terra uses the OpenAI Responses API with a strict JSON schema. Sonnet uses Anthropic Messages with `output_config.format`. An unsupported/unavailable model produces a visible system event and deterministic fallback, never a substitution. Rate limits, timeouts, malformed output, and provider errors follow the same safe fallback path.

After configuration, open **Town settings**, enter `ADMIN_SECRET` into **Operator secret**, and select **Real AI**. The secret is kept only in the tab’s memory; it is not persisted. Viewers never need it. Both providers must be configured to enable AI. Demo mode with a database is a real shared, persistent world with zero LLM cost.

### 4. Configure autonomous scheduling

Vercel Cron limits depend on the plan. Hobby has historically limited jobs to daily execution; Pro supports minute-level schedules. Check the current [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [Cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) for your project before enabling a schedule. This environment could not retrieve the current pricing page because outbound access to `vercel.com` was denied; plan-specific availability is not verified here.

The default `vercel.json` intentionally contains **no plan-restricted cron entry**, so it can deploy on Hobby. Choose ONE scheduler:

**Vercel plan with minute cron support:**

1. Copy `vercel.cron.json` over `vercel.json` and commit it before deploying. It preserves all function and header settings and adds `* * * * *` for `/api/tick`.
2. Set `CRON_SECRET` in Vercel Production and redeploy. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.
3. Check the job in Vercel’s Cron Jobs settings/logs. Cron executes on production deployments, not normal previews. Set a production custom domain if you want a stable independent scheduler address.

**Hobby-compatible external one-minute scheduler:**

Use a managed service such as [cron-job.org](https://cron-job.org/) that supports a 60-second interval and custom headers. No server management is needed.

1. Create a job targeting `https://YOUR-PRODUCTION-DOMAIN/api/tick` with method **GET**.
2. Schedule it every minute in UTC.
3. Add the secret request header `Authorization: Bearer <your CRON_SECRET>` using the service’s secure header settings. Do not put the secret in the URL.
4. Set a request timeout of at least 50 seconds. Enable failure notifications. A 409 response means an earlier tick is still holding the lease; the next scheduled minute can retry progression.
5. If Vercel Deployment Protection is enabled, configure the scheduler with Vercel’s automation bypass header as well, or use a publicly accessible production deployment. Keep that bypass secret secure too.
6. Enable the job and verify the checks below. External scheduler account availability and any service charges are your responsibility.

Each scheduled request uses the UTC minute as its idempotency key. Duplicate scheduler requests in the same minute commit at most one tick. Ticks do not replay every missed minute after an outage, so a scheduler failure cannot create a burst of catch-up AI spending. A paused world does not advance; operator stepping remains available. Scheduled demo worlds also evolve without visitors.

### 5. Test the actual production deployment — required

Do not mark deployment complete just because the Vercel build succeeded.

1. Open the production site. Confirm a 3D town loads, citizens move, selection/follow/orbit work, and the top-right indicator says **Shared world**, not **Private demo**.
2. Request `/api/health`; require HTTP 200 and `{"ok":true,"storage":"postgres",...}`. A database failure returns 503, not a false healthy response.
3. Open two independent browser sessions. Compare town day, treasury, citizens, events, and tick from `/api/world`. Both must read the same authoritative state. Reload and redeploy; state must remain.
4. Verify an unauthenticated GET to `/api/tick` and POST to `/api/control` both return **401**. Read-only `/api/world` is public by design.
5. As operator, enter the operator secret in settings. Save a snapshot, step once, load it, and confirm the town pauses and its prior state returns. Usage totals must stay unchanged by load.
6. Enable the scheduler, close all visitors for at least two minutes, and check that `/api/world` has a higher `world.tick`. Send two scheduler requests during the same UTC minute; there must be only one committed tick for that minute.
7. Set both exact model IDs, provider keys, pricing, and a small budget. Enable AI, run one tick, and verify **both** providers show a successful call and actual usage (no system fallback event). This is the live integration check; mocked tests cannot establish it.
8. Set `DAILY_USD_BUDGET=0`, redeploy, and run another tick. Confirm budget-reached events, no new provider calls, and continuing free fallback progression. Restore the desired budget and redeploy. Provider usage resets by UTC date, never by a deployment.
9. Run `DEPLOYMENT_URL=https://your-domain.example npm run verify:deployment` for a read-only HTTP smoke check. It verifies frontend HTML, database readiness, two shared-state reads, and protected mutations. It does not replace the live browser, provider, or scheduler checks.
10. Inspect the browser’s network responses and built `dist` for accidental secrets. Provider keys must never be in either. `/api/world` exposes model IDs and safe configuration status, never key values. Do not copy secrets into tests or terminal output.

## Persistence, concurrency, and costs

`worlds.state` is one authoritative JSONB document containing citizens, resources, election history, relationships, compact memories, positions, and simulation configuration. `saves` stores an operator snapshot, `ticks` stores idempotency records, and `usage_daily` stores per-provider accounting. Node globals cache a connection pool only; they do not own simulation state.

A short Postgres transaction locks the world row, checks idempotency and the lease, and reserves the **worst-case** token and price cost before any provider request is sent. The lease lasts 90 seconds. Calls run outside the transaction and in parallel. A second transaction verifies the lease token and state revision, then atomically commits world changes, usage settlement, and tick completion. All mutations, including operator controls, use the same row lock. A stale function cannot overwrite a recovered tick. A failed/crashed function may have consumed provider tokens, so its reservation remains charged; it is never blindly refunded. Expired leases recover automatically on a future tick.

Reservations bound prompt text by its UTF-8 byte count plus 4096 tokens for schema/framing overhead, and output is limited to 2200 tokens/provider. Actual reported usage settles successful calls. This deliberately favors stopping early over overspending. Both aggregate and per-provider ceilings apply before either parallel request. Zero budgets stop AI calls while the free engine continues. Prices must match your models and include any premiums; this is an application guard, not a billing guarantee from a provider. Also configure provider-side organization/project spend limits. No tools, arbitrary code execution, external browsing, retries, or recursive agent calls are available to the models.

The daily ledger uses UTC dates and Postgres integer microdollars. The UI shows **charged** usage, which includes uncertain reservations; successful actual usage is separately stored. Provider raw response bodies, keys, database URLs, and stack traces are excluded from API error responses and application logs. Normalized system events make failures visible without leaking provider details.

## API

| Route          | Method | Authentication        | Behavior                                                             |
| -------------- | ------ | --------------------- | -------------------------------------------------------------------- |
| `/api/health`  | GET    | Public                | Checks actual database read/seed, returns 503 if unavailable         |
| `/api/world`   | GET    | Public                | Shared world, daily usage, safe provider status, configured ceilings |
| `/api/tick`    | GET    | Bearer `CRON_SECRET`  | One scheduled tick per UTC minute, obeys pause                       |
| `/api/tick`    | POST   | Bearer `ADMIN_SECRET` | Manual tick, including while paused                                  |
| `/api/control` | POST   | Bearer `ADMIN_SECRET` | `{"action":"pause                                                    | play | mode | speed | save | load","value":...}` |

Manual tick POSTs require `Idempotency-Key: <current Unix milliseconds>:<UUID>`. Reuse the same key for retries; keys more than 24 hours in the past/future are rejected. The UI generates one for each explicit click. Returns 409 if another tick is running, 401 for bad/missing authentication, 400 for malformed input, and 503 for missing database/configuration. The idempotency journal retains two days. All API responses disable caching.

## Validation and development

```sh
npm run build         # Strict TypeScript check and production Vite bundle
npm test              # Rules, Postgres SQL/transactions, budgets, locks, API requests
npm run test:serverless # Emitted API boots in native Node ESM (no dev loader)
npm run test:browser  # Production-bundle Chromium UI checks, after build
```

The serverless smoke test compiles the API with NodeNext resolution and loads the emitted JavaScript in native Node, without Vite or tsx. Relative runtime imports explicitly use `.js` extensions so Vercel can resolve them. This catches startup failures that development-only module resolution can hide.

Database tests use **PGlite**, real Postgres compiled to WASM, with an adapter serializing its one connection. They test SQL persistence across service instances, leases, concurrent requests, idempotency, snapshots, provider reservations and failure charging, authentication, HTTP methods, and matching visitor state. They do **not** replace a live multi-connection Neon/Vercel test. No test contacts a paid model.

Browser tests require Chromium. This cloud machine provides `/usr/bin/chromium`. Else install Playwright’s Chromium with `npx playwright install --with-deps chromium`, or set `CHROMIUM_PATH` to your local browser executable. They exercise the built app, real WebGL canvas, demo ticks, inspection/follow, snapshots, refresh persistence, and mobile layout. Screenshots are saved under ignored `test-results/`.

## Scope and remaining verification

This is a complete playable framework, with intentionally modest game mechanics. Social interactions use a shared square, personality-driven provider prompts, and a numeric friendship/rivalry graph. Promises are short campaign messages rather than a separate policy-contract system. Construction completes one library. Elections trigger a confetti celebration in the square. Day/night changes with simulation phase, while characters, clouds, smoke, water and idle motion animate continuously. The simulation does not advance while paused. The private browser demo is never presented as multiplayer or autonomous.

For each target environment, verify real-provider access, exact model compatibility, Neon networking, Vercel production routing, scheduler delivery, production browser behavior, and physical device performance. The production checklist covers those checks. No local test should be interpreted as proof of a successful production provider call or autonomous scheduler delivery.
