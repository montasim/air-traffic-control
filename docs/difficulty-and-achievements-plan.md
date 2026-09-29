# Difficulty and achievements implementation plan

Status: implemented. Initial preset values remain candidates for longer playtesting.

## Product decisions

- Offer Easy, Medium, and Hard on every unlocked airfield. Difficulty never unlocks an otherwise locked map.
- Medium preserves current map behavior exactly and is the default for new and migrated saves. Remember the player's last selection.
- Keep aircraft collision shapes, landing acceptance, route input, warning thresholds, aircraft art, and runway geometry unchanged.
- One safe landing remains one point. All modes contribute equally to career ranks and map unlocks; Hard mastery is recognized by separate records and achievements.
- Keep the existing map-specific traffic patterns and aircraft mix. Difficulty changes pressure within each map, not its identity.
- Keep achievements inside Your career. Do not add currency, XP, power-ups, daily streaks, or another home-menu destination.
- Commit achievement progress with completed shifts, matching today's career contract. Restarting, leaving, or refreshing an unfinished shift discards its progress. A collision or sector exit finishes a shift and saves its preceding landings normally.
- For the first release, announce earned achievements on the results screen, not during active play. This avoids provisional unlocks and notifications obscuring aircraft. Show this completion rule in Career and leave-shift confirmation copy.

## 1. Difficulty model and traffic pacing

Add `src/core/difficulty.ts` containing `DifficultyId`, display metadata, preset values, and a pure `applyDifficulty(baseProfile, difficulty)` function. Reuse `resolveTrafficProfile` validation and never mutate shared map profiles.

Initial tuning values (subject to playtesting):

| Parameter | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Spawn interval multiplier | 1.35 | 1.00 | 0.80 |
| Aircraft speed multiplier | 0.90 | 1.00 | 1.10 |
| Pacing stage time multiplier | 1.30 | 1.00 | 0.85 |
| Opening spawn time multiplier | 1.35 | 1.00 | 0.80 |
| Concurrent traffic limit | Base minus 1, bounded 2–8 | Unchanged | Base plus 1, maximum 11 |

Apply stage-time multipliers to both arrival and traffic-limit schedules. Apply interval multipliers to interval values, retaining transition modes. The first opening spawn stays at time zero. Keep existing safe-spawn checks and deferrals; never force a spawn to meet the preset schedule. Medium must return equivalent base-profile values without rounding changes.

Preserve type weights, spawn corridors, target regions, speed variance, and existing turning behavior. Verify that the modest speed changes still allow all aircraft to follow practical routes. Tune the preset if they do not; do not compensate with hidden hitbox changes.

Integration: `src/game/maps/trafficProfiles.ts` supplies the base; `src/game/scenes/PlayScene.ts` passes the resolved preset profile into `Simulation`. Test seeded scenario equivalence for Medium.

## 2. Immutable shift configuration

Create an explicit run context at Play: unique run ID, map ID, orientation, and difficulty. Keep selected difficulty separate from active difficulty.

- Pause/resume, utility navigation, and Play again preserve active configuration.
- Restart uses the same difficulty with a new run ID.
- Layout-change restart preserves difficulty while creating the new orientation context.
- Main-menu selection affects only the next shift.
- Results and persistence consume the captured run context, not mutable current menu state.
- Guard delayed game-over callbacks against a disposed scene or replaced run.

Thread this through `src/main.ts`, `PlayScene`, and `CompletedShift` in `src/storage/gameStore.ts`.

## 3. Save schema and records

Upgrade the payload from schema version 2 to 3 in `src/storage/gameSave.ts`. Keep the IndexedDB database, store, and save key; this is a payload migration, not a new database.

V3 additions:

- `selectedDifficulty`.
- Per-map best scores indexed by difficulty, then portrait/landscape.
- Existing aggregate map and career landing/shift totals retained.
- Achievement evidence: cumulative landed counts by aircraft type, highest count of distinct types landed in one shift, and best initial warning-free landing count.
- Earned achievements keyed by stable ID, with an earned timestamp for new awards. Historical awards use a historical flag and no invented timestamp.
- Last committed run ID for retry/double-callback protection within the serial store flow. Reject stale scene callbacks in the application; this is not a general cross-tab synchronization system.

Migration:

1. Normalize V1 through its existing migration, then migrate V2 to V3.
2. Copy old portrait/landscape bests into Medium; initialize Easy/Hard bests to zero.
3. Preserve selected map, audio preferences, aggregate totals, ranks, and acknowledged promotions.
4. Initialize evidence that cannot be reconstructed to zero.
5. Backfill only achievements provable from saved totals and records, without showing historical unlock notifications.
6. Normalize invalid difficulty to Medium; ignore unknown achievement IDs and clamp invalid counters.
7. Update deep-clone helpers, persistence types, memory fixtures, and legacy compatibility functions. Compatibility helpers explicitly read Medium records.

Rank evaluation receives a derived per-map maximum across all difficulties for each orientation. Do not sum or duplicate aggregate landings during migration. Never lower an earned rank.

Maintain serialized store writes so audio, selection, and completed-shift updates cannot overwrite each other. Surface save failure as session-only progress rather than claiming it was stored successfully.

## 4. Achievement rules and evidence

Add a small pure catalog/evaluator in `src/progression/achievements.ts`; keep it independent of Phaser and DOM rendering. Each definition includes stable ID, name, requirement text, relevant Hugeicons icon key, and an evidence-based progress calculation.

| ID / name | Exact requirement | Historical backfill |
| --- | --- | --- |
| `first-landing` / First Landing | 1 cumulative recorded safe landing | Yes, career totals |
| `getting-comfortable` / Getting Comfortable | 10 cumulative recorded safe landings | Yes, career totals |
| `busy-shift` / Busy Shift | 10 landings in one completed shift, any mode | Yes, existing best scores while score equals landings |
| `mixed-fleet` / Mixed Fleet | At least one liner, commuter, and rotor landed in the same completed shift | No |
| `steady-hands` / Steady Hands | 10 landings before the first proximity warning in a completed shift | No |
| `airfield-explorer` / Airfield Explorer | At least one recorded landing on each of the four current airfields | Yes, per-map landing totals |
| `under-pressure` / Under Pressure | 10 landings in one completed Hard shift | No |
| `veteran-controller` / Veteran Controller | 100 cumulative recorded safe landings | Yes, career totals |

Freeze the Explorer requirement to the four current map IDs so future maps do not revoke earned badges. A later warning does not invalidate Steady Hands once the initial 10 landings were achieved. Warnings while paused cannot affect counters. Use existing simulation event ordering to resolve events in the same tick and test that ordering explicitly.

Extend the `landed` simulation event with aircraft type at emission time: the aircraft may already be removed when scene code consumes the event. Track landed type counts and the first-warning boundary in a small per-run tracker. It resets on every new run. Treat repeated warning emissions as a boolean boundary, not repeated penalties.

On completion, one serialized store update validates the run summary, updates records/totals/evidence, evaluates ranks and achievements, and returns newly earned IDs. Already-earned badges are immutable. Reprocessing the same run must not increment totals, replay promotions, or re-award achievements. Practice and development review fixtures use isolated state and never write to the real save.

## 5. UI integration

### Airfield selection

- Place a labeled three-choice radio group above Play in the selected-airfield panel.
- Labels: Easy, Medium, Hard. Descriptions: “More time to plan”, “A balanced challenge”, “Busy skies, quick decisions”.
- Remember selection and update displayed personal bests to the chosen difficulty.
- Replace Beginner/Intermediate/Advanced/Expert map labels with verified layout descriptions, such as “Parallel runways”, rather than introducing a second difficulty vocabulary.
- Keep keyboard selection, visible focus, 44px touch targets, and a compact mobile layout.

### During and after a shift

- Show a small difficulty label in the existing HUD, pause summary, and results; do not add a menu during play.
- Results compare against the same map, mode, and orientation.
- Add newly earned badges beneath results/progression feedback without adding more primary buttons. Use a compact summary if multiple badges unlock, with details available in Career.
- Keep promotion messaging and achievement announcements readable and sequential. Honor reduced motion and sound settings; no new sound is required for this release.

### Career and help

- Add an Achievements section to Career using cream badge cards, the teal page, amber earned accents, and existing typography.
- Show earned count, requirement text, and progress. Do not rely on color alone for locked/earned states.
- Use one mode filter for Career airfield records, defaulting to the selected difficulty; keep overall career totals clearly labeled.
- Keep unearned badges visible with achievable requirements. Do not show fake progress for historical evidence we do not have.
- Explain difficulty, separate records, and completion-based achievement awards briefly in How to Play. Practice remains its existing guided exercise without difficulty or rewards.

## 6. Verification and balancing

Automated checks:

- Medium matches current seeded traffic behavior; Easy/Hard transform schedules correctly without mutating base profiles.
- Profiles validate across four maps and three difficulties; safe-spawn deferral and caps still work.
- Speed changes do not regress route completion, landing capture, collision detection, or boundary behavior.
- V1/V2/V3 saves preserve progress, map unlocks, audio, and orientation scores; repeated normalization is stable.
- Difficulty records stay separate; rank calculations use derived maxima; aggregate totals count once.
- Achievement thresholds, mixed types, warning ordering, historical backfill, and duplicate completion handling.
- Audio/settings writes interleaved with completion do not lose records or awards.
- Practice/review isolation; fresh-run resets; pause/restart/orientation transitions retain the correct mode.

Browser checks:

- All mode choices, saved selection after reload, and Play again behavior.
- Desktop and 390px mobile home panel, HUD, pause, results, and Career; short landscape and scrolling states.
- Keyboard radio-group navigation, focus restoration, readable badge states, reduced motion, and non-overlapping notifications.
- Four maps × three difficulties × both orientations: inspect opening traffic and later pacing with deterministic fixtures, then manually play representative sessions. Fixture time acceleration verifies limits, not human difficulty balance.
- Test collision and sector-exit endings, leave/restart confirmations, refresh, and storage failure behavior.

Run `npm test` and `npm run build`. Record tuned preset values and reasons after playtesting; do not treat the initial multipliers as proven balance.

## Delivery order and completion criteria

1. Difficulty model and tests.
2. V3 migration, records, and immutable shift context.
3. Difficulty UI and end-to-end mode verification.
4. Achievement evidence, evaluator, and atomic completion integration.
5. Career badges/results presentation and help copy.
6. Full regression and gameplay balancing pass.

Done means all three modes work on every unlocked map; old saves retain their progress; scores compare within the correct mode; each of eight achievements awards exactly once from valid completed gameplay; menus remain compact and accessible; practice is isolated; and build/tests plus responsive browser checks pass.


## Implementation notes and verification

- V3 retains `bestScores` as an aggregate across difficulty records for existing rank evaluation; the visible records use `difficultyScores`. Legacy compatibility views explicitly use Medium.
- Achievement evidence stores the two historical maxima needed for Mixed Fleet and Steady Hands. Per-type counts are collected per shift and validated at commit, rather than storing unused cumulative type totals.
- Newly earned badges are shown after completion; historical badges are backfilled silently. Save failures produce a session-only progress message.
- Verified by automated tests: Medium seeded equivalence across all map traffic profiles, preset limits, old-save migration, threshold awards, warning boundaries, record isolation, duplicate completion, serialization, reload persistence, and failure reporting.
- Verified in the browser: Hard selection, HUD and pause mode labels, completion result and first badge, Career mode filter, desktop achievement cards, 390px mobile selection, and 844×390 landscape layout.
- Initial preset values have not undergone extended human difficulty balancing. Keep the values centralized for subsequent tuning.
