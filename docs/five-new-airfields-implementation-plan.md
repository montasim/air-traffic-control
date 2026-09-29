# Five new airfields: implementation plan

Status: implemented. Verification notes and remaining playtesting limits are recorded below.

## Scope and decisions

Expand the current four-map roster to nine with Falcon Air Base, Executive Point, Metro International, Freight Junction, and Island Rescue. Each must be a complete playable map, not a background reskin: authored geometry, scenery, traffic, previews, unlocks, records, and responsive layouts.

Airport category describes the setting; Easy / Medium / Hard controls pressure independently. Use Military, Business aviation, Passenger, Cargo, Rescue, and Regional categories. The four existing maps remain Regional. Do not use Civilian as a peer of Business or Passenger because those categories overlap.

Reuse the current three aircraft classes, colors, letters, silhouettes, routing behavior, and collision geometry for this release. Different traffic mixes establish the airport character. Military jets, VIP missions, combat, emergency timers, terrain collisions, new aircraft physics, and aircraft liveries are separate future work. This keeps Mixed Fleet and landing guidance meaningful on every map and avoids visual/collision mismatches.

## Codebase findings and integration points

| Area | Current implementation | Required treatment |
| --- | --- | --- |
| Map identity | `src/game/maps/mapIds.ts`, `registry.ts` register four maps | Register five unique IDs and definitions; retain existing IDs/order |
| Map contract | `types.ts`, `shared/definition.ts`: prepare/render, viewport layout, landing zones, guidance and HUD exclusions | Use the same contract; add missing validation for spawnable aircraft having compatible destinations |
| Airport geometry | `shared/airfield.ts`, shared-map geometry and painter | Reuse operational runways, taxiways and helipads; author category-specific scenery separately |
| Rendering | `shared-map/composer.ts` bakes terrain and retains operational vectors | Preserve layering and crisp runway edges; respect mobile/tablet/desktop detail budgets |
| Assets | `presentationAssets.ts` selects mineral only for Desert, meadow otherwise | Declare material choices explicitly for new maps; avoid accidental meadow fallback |
| Traffic | `trafficProfiles.ts` plus `core/difficulty.ts` | Add authored base profiles, then apply existing difficulty presets once at run start |
| Scene behavior | `PlayScene.ts` shares routing, collision, event feedback, shift evidence and pause | Keep one gameplay implementation for all maps |
| Audio | `AudioManager.ts`, `feedbackEvents.ts` share route, landing, collision, promotion and UI cues | New maps emit the same events, respect mute/volume and existing cooldown/priority policy |
| Saves | V3 in `gameSave.ts`; records initialized and normalized over `MAP_IDS` | Existing payload structure already supports more IDs; normalize missing records to zero |
| Career | `ranks.ts` evaluates totals and qualifying map scores | Extend unlock lists without changing existing rank thresholds or earned ranks |
| Achievements | `achievements.ts` uses map-wide score and landing evidence | Preserve old requirements; add a separate five-map collection badge |
| Map selection | `main.ts` has an inline strip and a four-ID layout-label lookup | Replace lookup with metadata; introduce a dedicated nine-map picker |
| Previews | `ui/mapPreviews.ts` uses real map renderers sequentially, with audio disabled | Include new definitions and ensure temporary render resources are disposed |
| Career UI | `ui/career.ts` has literal “All four airfields” copy | Derive roster counts and support nine record cards |
| Tests | Registry/contract tests iterate the roster, but runway-separation tests list four factories | Expand geometry coverage explicitly, including multiple helipads |

Important existing issue: Airfield Explorer currently has goal 4 and text about four airfields, but its evaluator iterates all `MAP_IDS`. Adding maps without fixing this would silently change which maps qualify. Freeze its qualifying IDs before expanding the roster.

## Map specifications

All maps include liner and commuter destinations plus at least one rotor destination. All three aircraft types remain eligible to spawn, even on specialist airports. No runway may terminate against another runway, overlap a terminal, or extend beyond safe layout bounds.

| Map / stable ID | Art direction and geometry | Routing distinction | Proposed unlock |
| --- | --- | --- | --- |
| Falcon Air Base / `falcon-air-base` | Muted olive terrain; hardened shelters, maintenance apron and service roads. Two separated offset runways, rotor pad at the outer apron. | Approaches from opposing sides; rotor routes require planning around fixed-wing arrivals. | Approach Controller |
| Executive Point / `executive-point` | Warm grass, compact cream terminal, private hangars and landscaped grounds. Staggered parallel runways with a clearly separated helipad. | Commuter-heavy, short routes; generous target separation avoids making compact scenery a touch-input penalty. | Control Assistant |
| Metro International / `metro-international` | Large restrained terminal and apron, simplified concourses and service areas. Two long parallel runways with a rotor pad beyond the terminal. | Liner-heavy traffic, long approaches and competing arrival directions. Terminal scenery never blocks route input. | Tower Controller |
| Freight Junction / `freight-junction` | Desaturated industrial ground, warehouses, loading bays and small container clusters. Offset runways separated by an apron and connected only by taxiways. | Longer cross-sector approaches; flight paths can intersect while runway surfaces remain separate. | Area Controller |
| Island Rescue / `island-rescue` | Muted blue water, sandy shorelines and cream rescue buildings. Two fixed-wing strips on a main island and two clearly separated rescue pads across islands. | Rotor-heavy traffic with a choice of compatible pads. Water remains traversable scenery. | Senior Controller |

Retain all current unlocks. Existing players immediately gain any additions their earned rank permits. New players can reach the added maps through existing maps, so no unlock dependency requires playing a map that is still locked. Chief Controller still means every airfield is available.

### Initial base traffic tuning

These values are starting points for Medium, not final balance claims. Define explicit profiles using the existing profile resolver and stage conventions.

| Map | Liner / commuter / rotor weights | Opening schedule | Arrival interval: start → late | Concurrent limit: start → late |
| --- | --- | --- | --- | --- |
| Falcon | 35 / 40 / 25 | commuter 0s, rotor 14s, liner 28s | 10s → 4.2s | 3 → 9 |
| Executive | 20 / 60 / 20 | commuter 0s, liner 16s, rotor 32s | 11s → 4.8s | 3 → 8 |
| Metro | 60 / 25 / 15 | liner 0s, commuter 14s, rotor 28s | 10s → 4.2s | 3 → 9 |
| Freight | 50 / 35 / 15 | liner 0s, commuter 14s, rotor 28s | 10s → 4.4s | 3 → 9 |
| Rescue | 15 / 25 / 60 | rotor 0s, commuter 16s, liner 32s | 11s → 4.8s | 3 → 8 |

Use existing gradual pacing over approximately six minutes; explicitly author intermediate stages and transition modes. Start with existing baseline aircraft speeds rather than adding category speed bonuses. Arrival directions must suit each layout, provide usable response time on small screens, and avoid immediate target capture or unsafe entry clustering.

The current Easy/Hard transformation handles speed, intervals, stage timing, and traffic caps. Never apply it in both map creation and scene start. Preserve safe-spawn deferral even if that delays an intended arrival. Make missing traffic profile IDs fail validation instead of silently receiving the default profile.

## Visual and geometry requirements

- Reuse teal operational surfaces, cream markings, amber/cyan/coral destination identity, muted terrain and current outline weights.
- Vary ground color, apron shape, buildings and coastline, not the meaning of destination colors or L/C/H labels.
- Keep props quieter than aircraft and route lines. Avoid dense rows of repeated marks, photoreal textures, tiny labels and excessive runway detailing.
- Category scenery is decorative. Parked aircraft, if used at all, must be unmistakably static and must not resemble selectable aircraft.
- Author portrait and landscape arrangements, plus square and short-landscape adaptations. Do not merely stretch the landscape layout into portrait.
- Keep runway shoulders, helipads, terminals and HUD safe areas separated. Check touchdown points and coarse-pointer acquisition regions as well as drawn runway rectangles.
- Island Rescue's two pads need distinct zone IDs, one guidance surface per pad, clear labels and predictable target selection. Both accept rotor aircraft; verify retained-target behavior and landing completion at either pad.
- Use actual map rendering for previews. At 640×360 the scenery and runway layout must remain recognizable.

## Implementation phases

### 1. Prepare metadata and preserve compatibility

Extend `MapMetadata` with typed `category` and `layoutLabel`. Move the hard-coded label lookup in `main.ts` into each definition. Remove obsolete map `difficulty` metadata once its references/tests are migrated; selected game difficulty remains a separate concept.

Add a small category catalog for labels and filtering. Keep category selection transient; do not add a saved preference without a user need. Define an explicit original-four map list for Airfield Explorer and an explicit new-five list for the new achievement.

Update map IDs, registry, traffic profile validation and material selection together. Use existing module boundaries; avoid introducing a generic map editor or a large schema-driven layout engine.

### 2. Build Falcon as the reference implementation

Create `src/game/maps/falcon-air-base/{index,layout,renderer}.ts`, exporting the map definition and layout factory using `defineMap`. Reuse operational painters and composition; add only the shelter/scenery drawing primitives it needs.

Verify Falcon in both orientations, at every detail level and difficulty, before using its shared scenery helpers elsewhere. Keep airport-specific geometry inside its map module.

### 3. Build the remaining four maps

Use equivalent directories for Executive Point, Metro International, Freight Junction, and Island Rescue. Share genuinely repeated buildings/material helpers, not whole cloned layouts. Each map must have a visibly different runway/apron arrangement and traffic pattern.

Implement Island Rescue last because it adds multiple compatible rotor destinations. Extend existing targeting and geometry tests; change shared routing code only if those tests reveal a real unsupported case.

### 4. Add the airfield selection page

Keep the home screen's selected-map summary, difficulty selector, preview and primary Play action. Replace the nine-card home strip with a single “Choose airfield” action opening `#airfields` through the existing utility navigation system.

The page uses the current teal background, cream cards and Back button. Show nine cards with actual previews, category, concise description, selected state, difficulty-specific best and unlock requirement. Provide All plus category filters in a compact wrapping control; no search is necessary for nine maps.

Selecting an available map persists its ID and returns to home with the existing difficulty retained. Locked cards explain the required rank without changing the saved selection. Browsing must not start a game. Back cancels browsing. Keyboard focus returns to the triggering button or selected map; native history, Escape and small-screen scrolling work as on other utility pages.

From a paused game, choosing another map must retain the existing abandon-shift confirmation before discarding anything. Do not allow a utility-page link to bypass that confirmation. Test reload and browser Back at `#airfields` as well as ordinary home navigation.

Career keeps the existing mode filter and shows nine record cards in a responsive grid. Replace literal four-map text with registry-derived counts. Preserve accessible labels and Hugeicons for meaningful actions.

### 5. Integrate records, ranks and achievements

Retain V3: map records are keyed by ID and the payload structure does not change. `createEmptyMapRecords`, normalization and cloning should automatically initialize the five new records for all three difficulties and both orientations. Add tests proving that behavior for V1, V2 and existing V3 saves. Keep the database/store/key unchanged.

Preserve every old score, earned/acknowledged rank, achievement timestamp, selected map, selected difficulty and audio setting. New empty records must not add landings, reset totals, trigger fake promotions or revoke unlocks. Rank qualification may consider any unlocked map; existing qualifying-map counts and score thresholds remain unchanged.

Achievement behavior:

- First Landing, Getting Comfortable and Veteran Controller count valid completed-shift landings on every map.
- Busy Shift and Under Pressure consider new records under their existing rules; Hard still means an actual Hard shift.
- Mixed Fleet and Steady Hands continue using per-run evidence, reset on restart.
- Airfield Explorer remains the original four, including for players who have not earned it yet.
- Add `expanded-horizons`: one recorded landing on each of the five new maps. Show progress 0–5 and use a relevant Hugeicons badge. Its qualifying list is fixed, so later roster changes cannot move the goal.
- Achievements remain completion-based, once-only, and saved in the same serialized update as records. Practice and review fixtures remain isolated from real saves.

### 6. Preserve audio, lifecycle and delivery behavior

No map-specific audio engine or ambient loop is needed. Reuse `GameAudio` for Play/map selection, route connection, landing, collision and promotion. Map changes must not recreate the audio manager, reset mute/volume, bypass gesture unlock or duplicate events. Do not invent a warning cue: the current warning feedback is visual and existing audio policy should remain intact.

Retain immutable run identity/difficulty, pause/resume, scene shutdown, delayed-callback guards, resize restart confirmation, results replay and failure-to-save messaging. Preserve the inline loading screen and boot readiness behavior. Preview work should remain sequential and silent; prioritize the selected preview if loading all nine becomes perceptibly slow. Ensure preview disposal and scene changes release temporary render textures and listeners.

Check the production PWA manifest/precache for any new assets and map modules. Reuse current tile materials where appropriate instead of preloading five large background images. Measure before adding lazy-loading machinery; category differences can be rendered with the current vector system.

## Verification and release gates

### Automated

- Exactly nine unique registry entries; valid profile and material for every ID; prepared map ownership validation still holds.
- Every spawned aircraft class has a matching destination; zone IDs are unique; each operational zone has guidance.
- Runway/shoulder separation, all-pad clearance, bounds, terminal exclusion and HUD exclusion at portrait, landscape, square and short-landscape sizes. Refactor the four-factory separation test to explicitly cover all nine rich layouts and every pad.
- New maps × three difficulties × two orientations: 30 core scenario combinations, plus regression coverage for the original 24. Seeded runs, safe arrival checks, route assignment/landing, warnings, collision and sector-exit completion.
- Regress coarse-pointer targeting between Island Rescue pads and prevent sticky selection of the wrong pad.
- Medium profile equivalence, no double difficulty application, traffic limits and deferred spawning at late pacing stages.
- Old-save normalization, new zero records, independent map/mode/orientation bests, all rank unlocks, no duplicated totals and immutable earned badges.
- Original Explorer requires exactly its original maps; new-five achievement requires exactly its five maps. New-map Hard results and mixed-fleet evidence award the correct existing badges only once.
- Shared audio event counts and mute/zero-volume behavior across scene changes; previews/practice never affect real saves or play feedback.
- Picker routing, locked-map behavior, abandon confirmation, focus restoration and serialized selection/settings/completion writes.

### Browser and visual

Review all five new maps in desktop landscape and phone portrait, and smoke-test square and 844×390 layouts. Exercise Easy, Medium and Hard, pause, settings, career, results, restart, orientation changes, keyboard picker navigation and touch-size targets. Verify all nine previews and locked/unlocked map cards, including a Chief Controller save.

Exercise sound on/off and volume through real browser gestures and inspect cue dispatch; do not claim audible verification without actually listening. Check loading/refresh, service-worker production build, browser errors and cleanup after repeated map switching. Compare preview generation and gameplay responsiveness against the four-map baseline, especially on the mobile detail tier.

Play representative early and late traffic sessions; deterministic acceleration can test limits but cannot establish human difficulty balance. Adjust map base profiles first, preserving the global Easy/Medium/Hard relationship. Record final values and remaining balance observations.

Run `npm test` and `npm run build`. Do not update old regression expectations merely to accommodate changed original-map behavior; those maps should remain stable.

## Completion criteria

All five maps are selectable at their specified ranks and visually distinct within the existing theme. All nine maps work with sound settings, all difficulties, independent records, career progression, achievements, pause/restart, targeting, collisions, responsive layouts, loading and previews. Existing saves retain progress. The original Explorer definition is protected, the new collection badge works, no unfinished/practice shift grants progress, and the automated/browser gates above have been recorded as passed or with explicit remaining limitations.


## Implementation verification

- Registered all five specialist maps, with authored landscape/portrait plans and compact/square adaptation. Shared scenery helpers keep the same runway, material and aircraft visual language.
- Added the category-filtered airfield page, nine real-render previews, rank unlocks, and the Expanded Horizons badge. Original Explorer is explicitly frozen to its original four IDs.
- V3 migration normalizes missing records; existing sound preferences, difficulty, ranks and records are preserved.
- Automated verification: 304 tests pass across 29 files, including every new destination landing on all three difficulties in both orientations, geometry at five viewport sizes, independent records, sound preference retention, and old/new Explorer separation.
- Browser verification: nine-map picker, category filtering, selected-map return, locked-map explanation without selection changes, every new map rendered, phone gameplay on Executive Point and Island Rescue, pause/resume, and both rescue pad labels. New map previews use the same live renderers.
- Production build and PWA precache generation pass. No new bitmap downloads or audio subsystem were introduced.
- Remaining validation limits: difficulty profiles have initial authored values, not extended human balance testing. Audio uses the existing tested cue pipeline; audible listening and low-end-device performance measurements were not performed in this session.
