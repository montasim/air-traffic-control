# Drizzle + Neon migration plan

Status (2026-10-08): implemented and verified against disposable local PostgreSQL.
Applying the migration to the user's Neon branch is pending Infisical project linkage.

## Goal

Move the Tower Challenge backend from the Netlify-managed database client to
Drizzle ORM connected directly to the existing Neon PostgreSQL database. Preserve
the current schema, ranking behavior, transaction isolation, anti-cheat checks,
retention job, and local integration tests.

This changes the database client and migration owner. It does not change the
public challenge API or the browser's IndexedDB-based local saves.

## Target architecture

```text
Web, Android, and desktop clients
              |
       Netlify Functions
              |
   Drizzle ORM + node-postgres
              |
       Neon PostgreSQL
```

Use `drizzle-orm/node-postgres` with a module-scoped `pg.Pool` and Neon's pooled
connection string. This is the smallest migration from the current `pg`-style
implementation and supports the interactive transactions, row locks, and
transaction-scoped advisory locks used by ranked submissions. Do not use the
Neon HTTP driver for this backend because the submission flow requires an
interactive transaction.

The database module is the seam. Function handlers import `db` and the schema;
they do not read environment variables or construct connections themselves.
There is one database adapter, so no repository interfaces or adapter hierarchy
will be added.

## Database URL and secrets

### Local development

Use an Infisical project with `dev` and `prod` environments. At the `/` secret
path, add `DATABASE_URL` and `COMPETITION_CREDENTIAL_PEPPER`, then run
`infisical init` once in the repository and commit the generated
`.infisical.json`. Database scripts use `infisical run` to inject those values
only into the child process. No `.env` file is created or read.

Use the Neon **pooled** connection string for the deployed Functions; its host
contains `-pooler`. Never use a `VITE_` prefix because Vite exposes those values
to browser code. Never place the real URL in `netlify.toml`, source files,
screenshots, test fixtures, or Git history. Rotate the Neon password immediately
if the URL is ever exposed.

### Netlify deployment

Configure an Infisical-to-Netlify Secret Sync for `DATABASE_URL` and
`COMPETITION_CREDENTIAL_PEPPER` so Infisical remains the source of truth and the
values are available to Functions. If migrations run in CI, authenticate the
Infisical CLI with a narrowly scoped machine identity; secrets must never enter
the generated frontend bundle.

Preview deploys must use a Neon development/preview branch, not the production
branch. Production Functions and production migrations use the production Neon
branch.

## Package changes

Add runtime dependencies:

```text
drizzle-orm
pg
```

Add development dependencies:

```text
drizzle-kit
```

Keep `@netlify/database-dev` temporarily as the real local PostgreSQL test
harness. Remove `@netlify/database` after every runtime import has moved to
Drizzle. `@types/pg` remains a development dependency.

Pin compatible Drizzle ORM and Kit versions together rather than using floating
tags. Record the exact versions in `package-lock.json`.

## File changes

Create:

- `drizzle.config.ts` — PostgreSQL dialect, schema path, migration output path,
  and `DATABASE_URL` loading from the process environment.
- `netlify/database/schema.ts` — Drizzle definitions for `challenges`, `players`,
  `runs`, `leaderboard_entries`, and `challenge_feedback`.
- `netlify/database/client.ts` — validates `DATABASE_URL`, creates one bounded
  module-scoped `pg.Pool`, and exports the Drizzle client and pool shutdown hook.
- `drizzle/` — generated, committed SQL migrations and Drizzle metadata.

Update:

- `netlify/functions/_competition.mts` — import the shared Drizzle client and use
  typed selects/inserts for ordinary queries.
- `challenge-start.mts` and `challenge-submit.mts` — use
  `db.transaction(...)`; preserve player locks, challenge kill-switch locks,
  idempotency, replay advisory locking, and atomic leaderboard updates.
- `challenge-feedback.mts` and `challenge-cleanup.mts` — use typed Drizzle
  mutations.
- `tests/competition/api.test.ts` — set `DATABASE_URL` to the disposable local
  PostgreSQL URL before importing the client, run Drizzle migrations, and close
  the pool during teardown.
- `package.json` — add `db:generate`, `db:migrate`, `db:check`, and optionally
  `db:studio` scripts.
- `README.md`, privacy/deployment documentation, and the operations runbook —
  replace Netlify Database provisioning instructions with direct Neon and
  Drizzle instructions.

Retire `netlify/database/migrations/` only after the Drizzle baseline is verified.
Keep the old migration in Git history; do not maintain two active migration
systems.

## Schema conversion requirements

The Drizzle schema must reproduce every existing database invariant:

- UUID primary and foreign keys.
- Unique credential hash, callsign, request key, and best-run relationships.
- Enumerated checks for map, orientation, difficulty, status, game-over reason,
  fairness answer, and fairness factor.
- Non-negative score, tick, attempt, latency, command-count, and payload checks.
- Seed range and challenge start/end ordering checks.
- Existing defaults and timestamp time-zone behavior.
- Composite leaderboard primary key.
- Ranking, open-run, replay-hash, and challenge/player indexes, including the
  partial verified-replay index.
- Existing four challenge seed rows without duplicating or overwriting them.

Generate the migration from the schema, then inspect the SQL. If Drizzle cannot
express an invariant clearly, retain that invariant as explicit SQL in the
generated migration. Type safety must not weaken database enforcement.

## Query migration rules

Use Drizzle's typed query builder for straightforward selects, inserts, updates,
deletes, joins, and conflict handling. Keep PostgreSQL-specific logic in
Drizzle's parameterized `sql` templates where that is clearer:

- `dense_rank`/`row_number` standings CTE.
- `FOR UPDATE` and `FOR SHARE` locking if the installed Drizzle version cannot
  express the exact lock.
- `pg_advisory_xact_lock` duplicate-replay serialization.
- Interval-based retention statements.

No query may interpolate user input into SQL text. All route submissions,
credentials, UUIDs, filters, and survey values remain parameterized.

## Migration sequence

### 1. Establish the Drizzle schema

1. Add dependencies and configuration.
2. Translate the current SQL schema into `schema.ts`.
3. Generate a baseline migration.
4. Compare generated SQL against the current migration constraint by constraint
   and index by index.
5. Run the baseline against a disposable empty local PostgreSQL database.

### 2. Migrate the runtime client

1. Add the shared Drizzle client with a small module-scoped pool.
2. Convert shared player, challenge, standing, and feedback queries.
3. Convert the start transaction while preserving its lock order:
   player, challenge, run creation, prior-run expiration.
4. Convert the submit transaction while preserving its lock order:
   run, player, challenge, replay advisory lock, leaderboard entry.
5. Convert feedback and cleanup queries.
6. Remove all runtime use of `getDatabase()`, `NETLIFY_DB_URL`, and raw
   `pool.query`/`pool.connect` calls outside the database module.

### 3. Choose the database-state path

#### Empty Neon database

Run the committed Drizzle baseline once with `npm run db:migrate`. Confirm the
five tables, constraints, indexes, and four challenge rows exist.

#### Neon database already has the current schema

Do not run the create-table baseline blindly. Compare the live schema with
`schema.ts`, resolve drift, then baseline the database in Drizzle's migration
journal so the existing objects are treated as already applied. Test this first
on a Neon branch cloned from production.

#### Existing rankings must move from another PostgreSQL database

1. Disable new ranked starts at the source.
2. Wait for or explicitly expire remaining open runs.
3. Copy schema and data with Neon Import Data Assistant or `pg_dump`/`pg_restore`.
4. Compare per-table row counts, leaderboard best-run foreign keys, challenge
   IDs, and representative standings.
5. Baseline the imported schema in Drizzle.
6. Point a preview deployment at the imported Neon branch and run the complete
   start/submit/retry/feedback flow.
7. Switch production `DATABASE_URL`, then re-enable ranked starts.

Do not merge two independently active ranking databases. One database is the
source of truth during cutover.

### 4. Verification

Required automated checks:

```text
npm run db:check
npm run typecheck
npm run typecheck:server
npm run test
npm run build
npm run build:desktop
npm run build:android
npm run test:desktop
```

The competition integration test must continue covering:

- Start, submit, ranking, and idempotent retry.
- Conflicting request keys and atomic replacement.
- Challenge disabled before and during final submission.
- Submission expiry and ruleset mismatch.
- Duplicate replay serialization across identities.
- Same-player concurrent best-score updates.
- Feedback eligibility, one-response limit, and played-challenge attribution.
- Cleanup retention behavior.
- Database connection failure returning a bounded 503 without leaking the URL.

Run one preview smoke test against a disposable Neon branch. Confirm the URL is
absent from browser assets, responses, and function logs.

## Cutover and rollback

Before cutover, create a Neon branch or restore point and record the old runtime
configuration. Apply migrations as a separate controlled action; do not run
`drizzle-kit push` against production and do not apply migrations automatically
on every Function invocation.

Cut over by changing only the server-side `DATABASE_URL` and deploying the
Drizzle runtime. Ordinary offline play is unaffected if the ranking backend is
unavailable.

Rollback by disabling challenges, restoring the previous deployment and its
database environment variable, and then re-enabling challenges after the old
backend is healthy. Do not delete the old Netlify-managed database or source
Neon branch until production has completed a full challenge cycle and retention,
cleanup, metrics, and feedback queries have been verified.

## Acceptance criteria

- Every competition query runs through Drizzle connected to direct Neon.
- No production code depends on `@netlify/database` or `NETLIFY_DB_URL`.
- The public competition contracts and deterministic verifier are unchanged.
- All existing database constraints, indexes, locks, and transaction guarantees
  remain effective.
- Existing ranking data is preserved when present.
- The real `DATABASE_URL` exists only in Infisical and the deployment platform's
  synchronized secret configuration.
- Tests and all three production builds pass.
