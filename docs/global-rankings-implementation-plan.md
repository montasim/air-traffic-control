# Verified weekly challenge and global rankings

Date: 2026-10-07

Status: implemented; deployment and player validation pending

Implementation progress (2026-10-07): all implementation phases are complete in
the repository. Ranked input is recorded at fixed simulation ticks, the server
authoritatively replays submissions, Neon PostgreSQL stores anonymous identities
and best-only standings, and the optional client flow covers offline, stale,
loading, rejected, retry, orientation-lock, and verified-result states. The web,
desktop, and Android builds pass; Drizzle owns the schema and runtime queries, and
the full start/submit transaction passes against local PostgreSQL. Production still
needs `DATABASE_URL`, the `COMPETITION_CREDENTIAL_PEPPER` secret, a migration, and
a Netlify deploy, followed by the
four-week player validation described in Phase 5.

## Recommendation

Do not ship one permanent leaderboard over ordinary shifts. Ship an optional
four-week **Tower Challenge** pilot with one shared ruleset per week and separate
portrait and landscape standings.

Each ranked run is started online, uses the server-declared challenge seed, runs
in a canonical logical world, records accepted route commands, and is replayed by
the server with the existing deterministic `Simulation`. The server-computed
result is the only result that can enter the standings. Normal play, local
records, career progress, and offline launch continue to work exactly as they do
now.

This is the smallest version that can answer both validation questions:

1. Do players return and improve their standing?
2. Do players consider the result fair?

If the pilot does not show repeat play and acceptable trust, stop there. Do not
build accounts, seasons, friends, rewards, or a permanent worldwide ladder.

## Why the ordinary score cannot be uploaded

The current game:

- starts `Simulation` with `Date.now()` in `PlayScene.startRun()`;
- varies map geometry and collision scale with the viewport and rendered canvas;
- applies difficulty and the optional two-end landing rule locally;
- accepts pause, resize, reload, and platform-specific lifecycle events;
- trusts the browser to report the final landing count;
- saves completed progress only to IndexedDB;
- has no account, server, database, or network trust boundary;
- must still launch and play offline as a PWA, Android app, and desktop app.

An endpoint that accepts `{ player, score }` would therefore rank incomparable
runs and be trivial to forge. The ranked mode needs its own explicit rules and an
authoritative verifier.

## Pilot rules

| Rule | Pilot decision |
| --- | --- |
| Duration | Four weekly challenges. Weeks use UTC start/end instants shown in the player's local time. |
| Participation | Opt-in. Never required for career progression, map unlocks, achievements, or local records. |
| Attempts | Unlimited while a challenge is open. Only the player's best verified run appears. |
| Map | One server-declared map per week. The pilot starts with `saltmarsh-gateway`, which is available to a new local career. |
| Difficulty | Fixed by the challenge; start with Medium. |
| Landing rule | Fixed to one highlighted runway end for the pilot. |
| Traffic | One server-declared seed for the challenge. Every attempt in an orientation sees the same traffic script, so improvement means learning the same problem rather than receiving an easier random run. |
| Orientation | Chosen from the device orientation at start, locked for the run, and ranked in separate portrait and landscape boards. |
| World | Exact existing logical profiles: portrait `900 × 1600`, landscape `1600 × 900`. Display size only scales that world. |
| Collision scale | Fixed per orientation in the challenge ruleset, not derived from physical screen size. Pick the values after phone/tablet/desktop legibility testing and freeze them for the full pilot. |
| Pause | Allowed and disclosed. The score is safe landings, not completion time; tie order never uses active play time. |
| End | Only a natural collision or airspace exit can submit a ranked score. Leaving, reloading, changing orientation, or abandoning a run records no result. |
| Ranking | Highest safe-landings score first. Equal scores share the same displayed rank. A stable internal order uses earliest verified achievement, then run ID. |
| Identity | Anonymous installation credential and a server-generated callsign such as `Controller 482193`. No free text, email, profile, password, or social login. |
| Visibility | Top 50 plus the player's own entry and two neighboring entries. Do not expose identity IDs or replay data. |
| Rewards | None. Ranked play must not affect the local career. |

The fixed collision scale is a real product gate. The existing presentation scale
also changes collision geometry to keep aircraft readable on small screens. A
ranked run cannot use that device-dependent value. If a single fixed value is not
readable across the supported screens, do not launch the pilot until the ranked
presentation and collision outline can remain understandable without changing
the physics.

## Architecture

```text
challenge screen
      |
      | start / submit / standings
      v
src/competition (one client-facing module)
      |
      v
Netlify Functions -- Drizzle ORM ----- Neon PostgreSQL
      |
      | verifyRun(spec, commands)
      v
existing map preparation + Simulation
```

Use Netlify Functions because the web build is already deployed on Netlify. Use
Drizzle with `node-postgres` and a pooled Neon connection for relational
constraints, interactive transactions, ordering, and indexed leaderboard queries.
Do not add a web framework, authentication provider, cache, queue, analytics SDK,
or realtime connection for the pilot.

### The competition module

Put online behavior behind `src/competition/index.ts`. UI callers need only:

```ts
getChallenge(): Promise<ChallengeState>
startChallenge(orientation: ChallengeOrientation): Promise<ChallengeRun>
submitChallenge(run: RecordedRun): Promise<SubmissionResult>
getStandings(orientation: ChallengeOrientation): Promise<Standings>
```

The module owns identity persistence, request timeouts, response validation,
offline states, retry safety, and mapping server failures to user copy. The UI
must not know database shapes, bearer tokens, endpoint paths, or replay details.
Do not add a TypeScript interface and adapter hierarchy: there is one remote
implementation. Tests stub `fetch` at this seam.

### Server endpoints

Use three function routes:

| Method and path | Purpose |
| --- | --- |
| `GET /api/challenge` | Return the active public rules, server time, top entries for both orientations, and cache metadata. No identity required. |
| `POST /api/challenge/start` | Validate the active challenge and orientation, create or authenticate the client-generated installation credential, create one run, and return `runId`, seed, frozen ruleset, expiry, and callsign. |
| `POST /api/challenge/submit` | Authenticate the identity, consume the run exactly once, validate and replay the command log, transactionally update the player's best entry, and return the verified result plus nearby standings. |

`GET /api/challenge?orientation=portrait&around=me` may refresh the player's
neighborhood when a valid credential is supplied. There is no endpoint for
changing a name, deleting another player's data, posting a raw score, or editing a
verified run.

All mutation responses use `Cache-Control: no-store`. The public challenge and top
standings response may use a short shared cache (for example 30 seconds) while an
authenticated neighborhood response stays private and uncached.

### Anonymous identity

On the first ranked start, the server creates:

- a random player UUID;
- a 256-bit bearer credential generated on the device before the first start request, so identity creation is retry-safe;
- only a salted hash of that credential in the database;
- a server-generated, non-offensive callsign with enough numeric entropy to avoid
  uniqueness failures.

Store `{ playerId, credential }` under a second IndexedDB key. Do not put it into
`GameSaveV3`, so online identity cannot break or migrate the offline career save.
If the credential is lost or site data is cleared, create a new identity; the old
entry remains anonymous and cannot be reclaimed in the pilot.

There is no cross-device identity. That is an explicit limitation, not a hidden
account substitute.

## Database schema

Use the Drizzle schema under `netlify/database/schema.ts` and committed migrations
under `drizzle/`.

### `challenges`

| Column | Constraint or purpose |
| --- | --- |
| `id` | UUID primary key |
| `slug` | Unique public stable identifier |
| `starts_at`, `ends_at` | UTC timestamps; `starts_at < ends_at` |
| `map_id` | Allow-listed map ID |
| `difficulty` | `easy`, `medium`, or `hard` |
| `two_end_landing` | Boolean |
| `ruleset` | Immutable verifier version, e.g. `challenge-v1` |
| `seed` | Fixed unsigned 32-bit seed returned with the public challenge rules |
| `enabled` | Emergency kill switch |

Seed the four pilot rows in a migration or a small one-off admin script. Do not
build an admin dashboard or scheduled rotation job.

### `players`

| Column | Constraint or purpose |
| --- | --- |
| `id` | UUID primary key |
| `credential_hash` | Unique salted hash; never return it |
| `callsign` | Unique generated display value, maximum 32 characters |
| `created_at` | UTC timestamp |
| `revoked_at` | Nullable manual abuse switch |

### `runs`

| Column | Constraint or purpose |
| --- | --- |
| `id` | UUID primary key |
| `challenge_id`, `player_id` | Foreign keys |
| `orientation` | `portrait` or `landscape` |
| `seed` | Copied from the challenge so the run remains self-describing |
| `ruleset` | Copied from challenge at start |
| `status` | `started`, `verified`, `rejected`, or `expired` |
| `started_at`, `expires_at`, `submitted_at` | UTC timestamps |
| `score`, `game_over_reason`, `end_tick` | Set only by verification |
| `rejection_code` | Bounded enum; no raw attacker text |
| `command_count`, `payload_bytes` | Operational and abuse metrics |
| `replay` | JSONB retained only for the pilot/debug retention window |

Index `(challenge_id, player_id, started_at)`. A run can transition from
`started` to exactly one terminal state. Repeated submission returns the stored
terminal result; it never verifies or ranks twice.

### `leaderboard_entries`

| Column | Constraint or purpose |
| --- | --- |
| `challenge_id`, `orientation`, `player_id` | Composite primary key |
| `best_run_id` | Unique foreign key to one verified run |
| `score` | Server-computed non-negative integer |
| `achieved_at` | First time this exact best was verified |

Index `(challenge_id, orientation, score DESC, achieved_at ASC, best_run_id ASC)`.
Update the row in the same transaction that marks a run verified. Replace it only
for a strictly higher score; equal retries do not erase the earlier achievement.
Use SQL `dense_rank()` for display so equal scores share rank.

## Deterministic recording and verification

### Frozen challenge specification

Create `src/competition/rules.ts` with the allow-listed `challenge-v1` values:

- map ID;
- difficulty;
- orientation and exact world dimensions;
- `detailLevel` used to prepare the map;
- landing mode;
- fixed collision scales;
- fixed step of `1 / 60` second;
- maximum ticks, route commands, points per route, and encoded payload bytes.

The client displays the server's specification, but both the client and verifier
derive actual gameplay objects from allow-listed values. Neither side accepts a
traffic profile, landing-zone geometry, collision scale, or world size supplied by
the other.

### Minimal simulation change

Keep `Simulation` as the authority. Add a fixed-tick counter to snapshots and a
single route-recording callback in `PlayScene`, or return enough normalized data
from accepted `assignRoute()` calls. Do not create a second scoring engine.

A recorded command is:

```ts
type RouteCommand = {
  tick: number;
  sequence: number;
  aircraftId: number;
  destinationZoneId?: string;
  points: readonly { x: number; y: number }[];
};
```

Record only commands that `Simulation.assignRoute()` accepted. A command's `tick`
means “this many fixed simulation steps have completed”; commands at that tick are
applied in sequence before the next step. Coordinates are mapped to the canonical
logical world and quantized to a documented precision
(for example one hundredth of a logical unit) before storage. Consecutive duplicate
points are removed. `tick` is the simulation tick, never wall-clock time.

Create one pure verifier interface:

```ts
verifyRun(spec: FrozenChallengeRun, commands: readonly RouteCommand[]): VerifiedRun
```

It prepares the selected map without rendering, creates `Simulation` with the
server-owned seed/profile/bounds/collision scales, advances exactly one fixed tick
at a time, applies commands in `(tick, sequence)` order, and stops at the first
natural game-over event. It returns score, reason, and end tick.

The verifier rejects rather than repairs:

- unknown ruleset, map, difficulty, orientation, landing zone, or aircraft;
- non-integer, negative, decreasing, duplicate, or out-of-range ticks/sequences;
- non-finite or out-of-world coordinates;
- too few/many points, routes, ticks, or bytes;
- a command that the authoritative simulation rejects;
- commands after game over;
- a submission without game over before the run limit;
- claimed metadata that differs from the server-owned run;
- malformed JSON or unexpected fields.

The server ignores any claimed score. A client result may be included only as a
diagnostic comparison; mismatch rejects the run and increments a metric.

### Versioning and deploys

Never point an old open challenge at mutable game code. `challenge-v1` must keep a
verifier implementation and rule constants for as long as a run can be submitted.

- A gameplay change that alters simulation, map layout, traffic profiles, landing,
  route smoothing, or collision creates a new ruleset.
- A visual-only change may keep the ruleset after the determinism fixture passes.
- A deployment must not edit an active challenge row's ruleset.
- Runs expire shortly after their challenge ends (for example 15 minutes) so old
  verifier versions can be removed after the retention window.
- Deploy previews use their branched database and non-production challenge slugs;
  they cannot write production standings.

## Client flow and UI

### Entry

Add **Tower Challenge** beside Career on the home tools row. Opening it never starts
a run. The screen shows:

- `Online challenge` and an optional-participation note;
- map, difficulty, landing rule, orientation division, and time remaining;
- `Play ranked`;
- top standings and the player's best when reachable;
- concise status for loading, offline, closed, unavailable, or unsupported build.

If the challenge map is locally locked, the ranked screen may grant temporary
access only inside that challenge; it must not unlock the map or alter career
progress. For the pilot's first map this case does not occur, but implement the
separation before rotating to locked maps.

### Ranked run

Starting waits for the server response before creating the simulation. Then:

- rebuild the game at the exact canonical world for the chosen orientation;
- ignore selected local difficulty and landing mode;
- use the challenge seed and fixed collision scales;
- show a visible `Ranked · Week N` marker;
- record accepted route commands in memory;
- keep pause and accessibility behavior;
- if orientation changes, pause and ask the player to return to the starting
  orientation or abandon; never rebuild ranked geometry mid-run;
- never write ranked results to local records, achievements, totals, ranks, or
  ordinary completed-shift counts.

Route recording is memory-only. A reload or process death abandons the attempt.
Do not persist live replays or add resume support.

### Result

At natural game over, show the local score immediately as `Verifying…` and submit
once. On success show:

- verified score;
- shared rank, percentile only when the population is large enough to be useful;
- movement from the player's previous best/rank;
- `Play again` and `View standings`.

On timeout or loss of connection, keep the in-memory payload and offer `Retry
verification`. Retrying uses the same run ID. Leaving the result screen discards
that retry opportunity; the local career remains unchanged.

Never show a rejected run as ranked. Use neutral copy (`This run could not be
verified`) with a retry only for transient failures. Validation, expired, already
consumed by a different payload, or ruleset failures are final.

### Standings accessibility

Use a semantic table or ordered list with text columns for rank, callsign, score,
and the player's marker. Do not communicate movement or rank by color alone. Keep
focus on the challenge heading after navigation, announce verification outcome in
the existing live region, preserve visible focus, and respect reduced motion.

## Complete state and edge-case handling

“All possible cases” here means every state transition and every foreseeable
product, network, trust, lifecycle, and data-integrity case in this design. New
platform failures still use the same safe fallback: no ranked write, ordinary
offline play remains available.

| Case | Required behavior |
| --- | --- |
| Offline at app launch | App and ordinary play work from bundled/cached assets. Challenge shows `Connect to view this week's challenge`; no repeated background polling. |
| Offline when opening challenge | Show cached public rules/standings as stale if available; disable ranked start because no server run exists. |
| Network lost after start | Let the in-memory run finish. Submit at game over; if still offline, offer retry while the result screen remains open. |
| Request timeout or 5xx | Abort after a bounded timeout, show retry, reuse the same idempotent operation/run ID. Never create a local ranked entry. |
| 400 malformed request | Final failure; log rejection code, not the full payload or credential. |
| 401 invalid/lost credential | Clear only competition identity after user-visible explanation, then create a new anonymous identity on the next start. Never touch career data. |
| 403 revoked identity | Disable ranked submission for that identity; ordinary play remains available. |
| 404/410 no active or closed challenge | Refresh challenge state and return to the challenge screen. |
| 409 duplicate submission | Return the original terminal result when the payload matches; reject when the consumed run is presented with different content. |
| 413 payload too large | Final verification failure. Limits are also enforced client-side. |
| 429 rate limited | Show a retry-after message; ordinary play remains available. |
| Challenge starts while screen is open | Refresh on explicit retry/focus and show it; do not auto-start. |
| Challenge ends while a run is active | Accept if `started_at < ends_at` and submission arrives before `expires_at`; otherwise mark expired. The rule is displayed before start. |
| No challenge configured | Hide start, show `No challenge is active`, retain ordinary play. |
| Challenge disabled mid-run | Submission returns unavailable and no rank; use only for integrity or cost incidents. |
| App version lacks the ruleset | Show `Update required for ranked play`; ordinary play remains available. |
| Server version lacks the run's ruleset | Operational error: keep the run unconsumed, alert, and restore verifier support or disable the challenge. |
| Orientation changes before start response | Reconfirm the division or restart the request; do not silently enter another board. |
| Orientation changes during play | Pause without advancing ticks; resume only in the original orientation or abandon. |
| Window resized within orientation | Scale the same canonical world; do not rebuild geometry, seed, or collision scales. |
| App backgrounded, screen locked, call interruption | Use the existing pause/lifecycle path. No simulation ticks or commands accrue while paused. |
| Manual pause | Allowed equally and does not affect tie order. |
| Reload, crash, OS kill, browser close | Attempt is abandoned and later expires; no score and no career mutation. |
| Player abandons/restarts | A successfully created replacement atomically expires the prior open run. A failed start leaves the prior run valid. The new run uses the same challenge seed. |
| Double tap on start | Disable the control while pending and use one request idempotency key. At most one run is returned. |
| Double game-over event | Existing run guard plus unique run ID causes one submission and one terminal database transition. |
| Two tabs/windows | The newest successfully issued clearance wins and expires an older open run for that identity. A superseded tab gets an explicit rejection; verified best updates remain transactional. |
| Same identity on cloned storage | Both authenticate as one player; only the best verified run survives. This is acceptable for the pilot. |
| Cleared site/app data | Local career and competition identity behave according to existing platform clearing semantics; a new callsign is issued. Old rank is not recoverable. |
| Private browsing / IndexedDB unavailable | Ordinary play falls back as today. Ranked play can finish in the current session with an in-memory credential, but identity continuity is not promised after reload. |
| Local clock wrong | Server time controls challenge windows, expiry, and ordering. Client time is display-only. |
| Slow device / dropped frames | Fixed-step simulation and tick commands remain authoritative; cap catch-up as today and test that equivalent inputs replay. |
| Touch, mouse, pen | All map through the same logical coordinates and command format. Input device is neither stored nor ranked separately. |
| Reduced motion | Presentation changes only. Simulation, commands, verification, and board are identical. |
| Audio off / unsupported | No effect on ranked rules or verification. |
| Different livery | Cosmetic only and omitted from replay/rules. |
| Local difficulty/map/landing setting changes | Ignored for the ranked run and restored unchanged on return to ordinary play. |
| Locked challenge map | Temporary challenge-only access; no career unlock or map selection persistence. |
| Client changes seed/settings/score | Ignored or rejected; server-owned run data and replay result win. |
| Client edits route log | Authoritative replay either reproduces a legal run or rejects it. A fabricated but legal command log can still pass; replay verification proves game-rule validity, not that a human produced the input. |
| Replay copied to another run/player | Store a canonical replay hash and withhold/flag an exact cross-identity duplicate. Because the shared seed is public and the client is untrusted, a modified copied log or independently fabricated legal log cannot be distinguished reliably; no prizes are attached to the pilot. |
| Replay submitted twice | Idempotently return the first result. |
| Commands out of order / at same tick | Require monotonic `(tick, sequence)` and apply in sequence order. Duplicate pairs reject. |
| NaN, Infinity, huge coordinates, huge arrays | Reject before simulation using strict schema and byte/count/range limits. |
| Score overflow / extremely long run | Integer score comes only from replay; maximum ticks and commands bound CPU, memory, and score. |
| Database unavailable | Return 503; never claim verification. Retry is safe. |
| Verification times out | Leave run `started`, return 503, and allow retry. Do not partly update standings. |
| Function succeeds but response is lost | Retry returns the stored terminal result. |
| Standings read fails | Ranked play may start only if start is healthy; show result without rank if verification succeeded, then let standings refresh later. |
| Equal scores | Same displayed dense rank. Earlier verification only stabilizes order; copy must not imply it beat an equal score. |
| One player has many attempts | One leaderboard entry; attempts remain internal metrics. |
| Empty/new board | Show an inviting empty state, not rank zero. |
| Fewer than 50 entries | Return all entries. Do not calculate a misleading percentile for tiny populations. |
| Callsign collision | Generate again inside the insert transaction. No client-supplied text. |
| Offensive names | Impossible in the pilot because callsigns come from an audited server list plus digits. |
| Bot or solver produces legal replay | Server verification cannot distinguish skill from automation. Rate-limit attempts, flag extreme volume, disclose that the pilot is unprized, and manually remove clear abuse. Do not pretend replay verification is bot prevention. |
| Identity farming / reset | Multiple callsigns are possible. With one entry per identity and no prizes, monitor rather than add invasive fingerprinting. |
| Denial-of-wallet / request flood | Tight payload/run limits, per-credential attempt limits, platform rate limiting where available, database indexes, cached public reads, usage alerts, and the challenge kill switch. |
| Accidental secret logging | Redact `Authorization`, credential, and replay coordinates from logs. Log request ID and bounded codes only. |
| Privacy request | With no account or PII collected, document the anonymous data and retention. Add credential-authenticated self-deletion only if policy/legal review requires it before pilot. |
| Backup/rollback | A code rollback must keep active ruleset verification. Database migration is additive and backward compatible during an active week. |
| Web works but packaged app cannot connect | Treat each platform as a separate release gate; do not advertise rankings there until API origin, CORS, and transport tests pass. |

## Abuse, privacy, and operational limits

- Accept JSON only; enforce method, content type, same production origin where
  applicable, and an explicit CORS allow-list for the web, Android, and
  `aircontrol://game` desktop origins.
- Use constant-time credential hash comparison or an indexed hash lookup followed
  by a constant-time verifier. Never store the plaintext bearer credential.
- Allow one current open run per identity and cap starts per hour per identity.
  Treat IP-based platform limits as a coarse outer guard, not identity.
- Do not collect email, contact lists, precise location, advertising IDs, or free
  text. Do not build device fingerprinting for the pilot.
- Retain verified scores/anonymous callsigns for the four-week pilot and a stated
  review window. Delete rejected/expired runs and raw replays after 30 days; keep
  aggregate, non-identifying metrics.
- Update `public/privacy.html`, README data-storage copy, and store disclosures
  before release. State that ranked mode sends an anonymous identifier and gameplay
  command log to the ranking server.
- Add a manual SQL runbook to revoke a player, remove a leaderboard entry, disable
  a challenge, and delete retained replay data. Do not build admin UI.
- Configure usage/billing alerts and watch function count, verification duration,
  database compute, 4xx/5xx rates, rejection reasons, and payload sizes.

## Implementation phases

### Phase 0 — product and infrastructure gate

1. Confirm the Netlify plan supports Database and set a pilot cost ceiling/alert.
2. Approve the rules table above, anonymous callsigns, retention, privacy copy, and
   `pause allowed` policy.
3. Run a legibility test for the fixed portrait/landscape collision scales on the
   smallest supported phone, tablet, and desktop. Freeze the values in `challenge-v1`.
4. Define the four challenge rows and UTC windows. Do not begin UI work until the
   deterministic proof in Phase 1 passes.

Exit: one written `challenge-v1` specification and confirmed infrastructure cost.

### Phase 1 — deterministic proof

1. Add a simulation tick to the authoritative state and capture accepted route
   commands without changing ordinary gameplay.
2. Implement `verifyRun()` using map `prepare()`, `applyDifficulty()`, the existing
   traffic profile, and `Simulation` only.
3. Add a fixture that records a real run once and proves browser-side execution and
   Node verification produce the same score, reason, tick, and event sequence.
4. Run the fixture for portrait and landscape, collision and airspace exit, pause
   gaps, multiple commands in one tick, and each pilot map/ruleset.
5. Prove that a one-coordinate, one-tick, seed, difficulty, map, collision-scale,
   or landing-mode mutation rejects or changes the authoritative result.

Exit: deterministic replay passes repeatedly on the supported Node version and in
Chromium. If it does not, stop; do not ship a trusted ranking.

### Phase 2 — server and database

1. Add Drizzle, the Neon PostgreSQL connection module, schema, and migrations.
2. Implement strict request parsing and the three function routes without a server
   framework.
3. Implement identity issuance/authentication, run expiry, replay verification,
   idempotent terminal transitions, and transactional best-entry upsert.
4. Seed non-production challenges and add integration tests against local Postgres.
5. Add bounded structured logs, cache headers, CORS allow-list, limits, and the
   emergency `enabled` check.

Exit: forged scores cannot be written; duplicate/racing submissions result in one
terminal run and one best entry.

### Phase 3 — client and UI

1. Add the competition module and separate IndexedDB identity key.
2. Add the home entry, challenge screen, semantic standings, loading/error/empty
   states, and update-required state.
3. Add ranked run launch with frozen rules, visible ranked marker, in-memory command
   recorder, orientation lock, and result verification states.
4. Ensure ranked completion bypasses `gameStore.recordShift()` completely.
5. Add retry while the result screen is alive and restore all ordinary settings on
   exit.

Exit: every network and lifecycle case in the table has a visible, accessible state
and ordinary offline play remains unchanged.

### Phase 4 — platform and security verification

1. Web/PWA: online start/submit, cached offline launch, update during an active run,
   two tabs, storage clearing, and stale service-worker behavior.
2. Android: Internet access, TLS, lifecycle pause/resume, rotation, process death,
   and production API origin.
3. Electron: `aircontrol://game` fetch support, CORS, navigation restrictions,
   offline behavior, packaged production build, and no credential exposure to Node.
4. Abuse tests: oversized/nested JSON, malformed numbers, unknown fields, expired
   run, copied replay, changed payload on retry, concurrency race, flood/rate limit,
   and log redaction.
5. Load test public standings reads and worst-allowed verifier payload at the pilot's
   expected concurrency plus headroom.

Exit: all three shipping platforms can participate or are explicitly marked
unsupported; no platform silently submits unverified scores.

### Phase 5 — four-week pilot and decision

Roll out behind a build-time `VITE_CHALLENGE_ENABLED` kill switch:

1. Internal/non-production challenge.
2. Small public pilot without rewards.
3. Review after each week; keep rules frozen during a week.
4. At four weeks, choose: remove it, iterate once, or plan a durable ranking product.

Do not expand scope during the pilot unless required for integrity, accessibility,
data loss prevention, or platform compatibility.

## File-level plan

| File/area | Change |
| --- | --- |
| `src/core/Simulation.ts`, `src/core/types.ts` | Expose deterministic tick evidence needed by recording/verifying; keep ordinary behavior unchanged. |
| `src/game/scenes/PlayScene.ts` | Accept a ranked run configuration, use its seed/scales, emit accepted route commands, lock rules, and avoid local progression on ranked completion. |
| `src/game/viewport.ts` | Reuse existing canonical profiles; add no new responsive profile system. |
| `src/competition/rules.ts` | Frozen ruleset constants, types, limits, and allow-list validation. |
| `src/competition/verifyRun.ts` | Pure authoritative replay verifier shared by tests and Netlify Functions. |
| `src/competition/index.ts` | Deep client module for challenge state/start/submit/standings, identity, timeout, validation, and user-safe failures. |
| `src/competition/persistence.ts` | One IndexedDB key for anonymous identity; no `GameSaveV3` migration. |
| `src/ui/challenge.ts` | Challenge detail, standings, and result rendering. |
| `src/main.ts`, `index.html`, `src/styles.css` | Minimal navigation, ranked launch/result wiring, states, responsive styling, and accessibility. |
| `netlify/functions/challenge.mts` | `GET /api/challenge`. |
| `netlify/functions/challenge-start.mts` | `POST /api/challenge/start`. |
| `netlify/functions/challenge-submit.mts` | `POST /api/challenge/submit` and authoritative verification. |
| `netlify/functions/_competition.ts` | Shared parsing, authentication, response, and database transaction helpers used by at least two functions. No general server framework. |
| `netlify/database/schema.ts`, `netlify/database/client.ts` | Typed schema and the server-only Drizzle/Neon connection. |
| `drizzle/` | Tables, constraints, indexes, and four pilot challenge rows. |
| `netlify.toml` | Function route mapping/headers only if inline function paths do not cover it. |
| `vite.config.ts` | Build-time feature flag/API origin only; preserve offline asset behavior. |
| `electron/main.cjs`, `capacitor.config.ts`/Android config | Permit only the production ranking origin if packaged networking requires it. |
| `public/privacy.html`, `README.md`, `PRODUCT.md` | Optional online mode, transmitted data, retention, no-account limitation, offline preservation, and competition rules. |

Do not modify `src/storage/gameSave.ts`, progression ranks, achievements, local map
records, or ordinary completed-shift semantics for the pilot.

## Verification matrix

### Unit

- ruleset schema and every invalid enum/range/limit;
- credential creation/hash verification and callsign collision retry;
- replay sorting, duplicate detection, coordinate quantization, and payload caps;
- verifier result for both orientations and both game-over reasons;
- leaderboard best-only upsert and dense-rank tie behavior;
- client response parsing and user-safe error mapping.

### Integration

- start → natural finish → verify → ranked entry;
- higher, lower, and equal subsequent scores;
- simultaneous submissions for the same player;
- lost success response followed by identical retry;
- same run with changed retry payload;
- challenge opens/closes at exact UTC boundaries;
- active-before-close submission inside/outside grace period;
- revoked identity, expired run, disabled challenge, unknown ruleset;
- database error before and during transaction with no partial entry;
- production and deploy-preview database isolation.

### End to end

- new player on web, Android, and Electron;
- returning identity and personal neighborhood;
- portrait and landscape boards;
- offline before start, loss during run, and recovery at result;
- rotate/resize/background/pause/reload/crash behavior;
- screen reader, keyboard navigation outside gameplay, reduced motion, zoom, and
  smallest supported viewport;
- ordinary offline shift before and after ranked play with byte-for-byte-equivalent
  local career changes to the pre-feature behavior.

### Release gates

- full existing test suite, typecheck, web build, Android build, and desktop build;
- deterministic fixture passes 100 repeated runs per pilot spec;
- maximum legal replay verifies within the function time/cost budget;
- no plaintext credential, replay, or authorization value in logs;
- privacy and store disclosures reviewed;
- kill switch and manual removal runbook tested in non-production;
- no active ruleset is removed by deploy or rollback.

## Acceptance criteria

The pilot is ready only when:

1. A submitted numeric score alone can never create or update an entry.
2. Every displayed score came from a server replay of a server-issued run.
3. Map, difficulty, landing mode, seed, world, collision scale, and ruleset are
   identical for every entry in one orientation division.
4. Equal scores display equal rank and each identity occupies at most one row.
5. Retry after a lost response cannot create a second result.
6. Ranked play never changes local career, achievements, unlocks, settings, or
   ordinary best scores.
7. No connection, database failure, rejected replay, or expired challenge prevents
   ordinary offline play.
8. Web, Android, and Electron either pass the ranked flow or clearly do not expose
   it for that release.
9. The active challenge survives deploy/rollback with its verifier intact.
10. The privacy page accurately describes anonymous identity, command-log upload,
    retention, and loss of identity when local data is cleared.

## Validation and stop criteria

Capture aggregate events through the ranking database/function logs; do not add a
third-party analytics SDK for this pilot:

- challenge screen viewed;
- ranked run started, naturally completed, abandoned/expired, verified, rejected;
- verification latency and retry count;
- unique anonymous participants per week;
- participants with 2+, 3+, and 5+ attempts;
- participants who improve their best;
- median attempts to improvement and week-over-week return;
- standings views after a result;
- rejection/error rate by bounded code and platform.

Add one optional two-question prompt after a player's third verified run, at most
once for the entire pilot:

- `The weekly challenge felt fair.` — Agree / Not sure / Disagree
- `What affected fairness?` — Same rules / Device or controls / Pausing / Suspicious
  scores / Connection or verification

No free-text feedback is needed in-game; link to the existing issue channel for
details.

Set numerical success thresholds before launch. Suggested starting thresholds,
to be adjusted for audience size:

- at least 30% of participants make a second attempt;
- at least 15% return in a later challenge week;
- at least 25% improve a verified best;
- at least 70% of respondents agree the challenge felt fair;
- fewer than 2% of completed natural runs fail verification for non-network reasons;
- p95 submission verification stays within the chosen function latency/cost budget.

Stop or keep the feature disabled if deterministic replay is unreliable, fixed
physics are not legible on supported screens, operating cost exceeds the pilot
ceiling, non-network verification failures exceed the gate, or fairness sentiment
misses the threshold. A weak result should remove the pilot rather than trigger an
account system or heavier anti-cheat by default.

## Explicitly deferred

- permanent all-time global leaderboard;
- accounts, email, passwords, social sign-in, and cross-device recovery;
- custom display names, moderation UI, chat, follows, friends, or teams;
- prizes, career rewards, paid entry, or unlock advantages;
- realtime standings, spectators, ghosts, and replay downloads;
- seasons, divisions beyond orientation, matchmaking, and skill ratings;
- device fingerprinting, kernel/desktop anti-cheat, CAPTCHA by default, or bot
  claims the verifier cannot support;
- admin dashboard, additional data framework, cache cluster, queue, background worker, and general API
  framework.

Add any of these only after the bounded pilot demonstrates repeat play and trust,
and only for a measured problem the pilot exposes.
