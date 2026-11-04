# Harbor traffic game — web implementation plan

Date: 2026-10-05
Status: Proposed implementation specification; no game implementation or new artwork has been produced by this document.
Scope: A complete browser game. Android and desktop applications begin only after the user is satisfied with the web version and requests those phases.
Working concept: Harbor Master. Choose a different release title; this name already identifies existing games.

## 1. Product direction

Build a polished, top-down 2D harbor traffic game in which players draw ship routes, coordinate a shared entrance channel, manage occupied docks, and complete deliveries by guiding ships safely back to sea.

The central decision is **which movement should happen next**. Routing, dock availability, and channel direction should create understandable choices within a small, readable map.

Example: a loaded ship waits outside while a serviced ship occupies its destination berth. Open the channel outbound, clear the departing ship, then reverse it and admit the waiting arrival. A ferry competing for the next passage creates the next decision.

This is a deliberate combination and emphasis, not a claim of unprecedented mechanics. Research identified direct precedents for docking, unloading, departures, narrow channels, and constrained turns. See [the research note](harbor-master-research.md).

### Intended experience

- One-pointer play with a mouse, touchscreen, or pen.
- Short, satisfying shifts with immediate restart and increasing pressure.
- A lively working harbor with clear routes, restrained scenery, readable vessels, and satisfying delivery feedback.
- Predictable movement: mistakes should be explainable from visible information.
- Offline browser play after the game has been downloaded and cached successfully.
- No account, backend, advertisements, purchases, or network dependency during a shift.

### Delivery boundaries

| Stage | Included |
| --- | --- |
| First playable | One simple harbor, two vessel classes, full arrival/service/departure loop, channel control, placeholder art, one difficulty |
| Web vertical slice | The same harbor with finished art, sound, tutorial, touch controls, results, settings, and local records |
| Complete web v1 | Three tested maps, practice, timed shifts, endless mode, three difficulty presets, local progression, install/offline support, browser QA, deployment-ready build |
| Later, only after web satisfaction | Android and desktop packaging, platform lifecycle work, signing, store material, distribution, and platform-specific QA |
| Separate future expansion | Tides, weather, tugboats, construction, fuel, multiplayer, accounts, cloud saves, online leaderboards, monetization |

The three-map web release is a proposed content target. Build and validate one complete map before investing in the other two. Do not build platform wrappers during this plan.

## 2. Asset creation comes after a layout brief, before final visual integration

We do need map and vessel assets, but a finished generated map is not a prerequisite for writing the implementation plan. The correct order is:

1. Define the rules and measurable space requirements.
2. Draw a simple layout with water, land, docks, holding areas, channel gates, spawn areas, and exit areas.
3. Test that layout using placeholder vessels and the proposed movement constraints.
4. Generate an art concept around the tested layout and establish the visual direction.
5. Produce the terrain materials, scenery, vessel artwork, and interface assets.
6. Integrate them against the same layout data and inspect at actual play sizes.
7. Revise artwork or layout deliberately when testing reveals a problem.

A concept image may be generated early to explore style. Label it as a concept; it is not automatically a playable map. Avoid generating all three finished maps before the first harbor is proven.

The existing Air Traffic Control [River Bend art record](../art/visual-v2/river-bend/README.md) separates generated terrain from operational geometry. Its [current asset loader](../src/game/assets/presentationAssets.ts) uses shared materials, and the [asset simplification note](arcade-asset-simplification.md) documents retained vector gameplay elements. Reuse that separation, rather than assuming the old full terrain plates remain the active rendering approach.

### Source of truth

Map data owns coastlines, navigable water, collision polygons, berth positions, turning clearance, channels, and spawn/exit zones. Artwork illustrates that geometry; the program never guesses navigability from image colors.

Prefer generated land/water materials and decorative pieces clipped or positioned by the map renderer. A full terrain plate is acceptable only if its visible shore matches the tested geometry and it passes an overlay inspection. Regenerate or correct mismatched art; never silently accept water that looks navigable but collides.

### Proposed visual direction

- A fictional river-delta harbor, with green banks, warm sand, blue-green water, colorful cargo, ferry terminals, and small waterfront settlements.
- Strict top-down view; avoid perspective that obscures the ship footprint or berth position.
- Stylized illustration with broad shapes and restrained texture. Fine detail stays outside traffic areas.
- Ferry and cargo vessels use clearly different silhouettes, plus icons/letters and colors. Color is never the sole destination cue.
- Routes, warning states, selection, and channel direction have stronger contrast than scenery.
- Water ripples, wakes, crane movements, and arrival/departure feedback support the action without masking it.
- Reduced-motion mode removes decorative water drift, shake, and excessive particles while preserving movement and essential state feedback.

### Asset manifest

Names and dimensions below are proposed production targets, to be checked at actual viewport sizes.

| Asset | Production method | Runtime form | Acceptance |
| --- | --- | --- | --- |
| Harbor style concept | Image generation from a layout reference and art brief | Review image, not shipped | Top-down view and readable traffic areas |
| Water, sand, grass materials | Generated textures or simple authored fills | Small WebP textures, initially 512–1024 px | No seams, no baked boats, no misleading rocks |
| Map-specific terrain treatment | Compose materials using map geometry; optional generated plate | Cached terrain layer; optional WebP plate | Shoreline and collision overlay agree |
| Ferry and cargo vessel | Generate a consistent top-down sheet or author simple vector silhouettes | Transparent PNG/WebP sprites; optional atlas | Clean alpha, common bow direction, centered pivots, readable hulls |
| Docks and operational markings | Geometry-driven vector rendering | Retained vector objects | Rendered berth/gate position equals simulation data |
| Warehouses, cranes, trees, houses | Generated cutouts or authored sprites | One small scenery atlas | No overlap with required clearances; consistent light |
| Wakes, ripples, service feedback | Small textures and code animation | Pooled effects | Decoration never counts as a collision surface |
| UI icons and destination symbols | Simple authored SVG/vector shapes | SVG or vector objects | Legible and distinguishable without color |
| App icon and favicon | Derive from the chosen game identity | SVG/PNG browser assets | Recognizable at small sizes; no aircraft leftovers |
| Map selection thumbnails | Capture the actual finished map | WebP | Matches the playable layout |
| Social preview image | Compose from finished game artwork | Share image with matching metadata | Accurate title and current gameplay |
| Audio | Synthesized effects or licensed/owned recordings | Small compressed files or Web Audio synthesis | Clear warnings; mute/volume control; documented provenance |

For generated vessel sprites, verify silhouette quality after rotation and downscaling. Keep invisible padding out of collision calculations. Use a separately defined hull polygon that matches the visible body; exclude wakes and soft shadows.

### Art source organization in the future game project

```text
art/
  direction.md
  provenance.md
  concepts/
  maps/delta-harbor/
  maps/river-bend/
  maps/island-port/
  vessels/
public/assets/
  terrain/
  vessels/
  scenery/
  audio/
  ui/
```

Store prompts, source/reference images, tool/model information when available, generation dates, revisions, export settings, and licenses beside the source assets. Keep large source images out of runtime bundles. Use the image-generation tool for generated artwork and edits; this plan itself does not generate images.

### First map art brief

Create a calm, fictional delta port with a single visible entrance, a broad inner turning basin, one ferry berth, one cargo berth, and clear waiting water outside. Put dense scenery on land at the perimeter. Keep all navigable water visually quiet. Do not bake ships, text, routes, warning symbols, channel lights, or service indicators into the terrain.

Before generation, attach the actual layout reference and explicit reserved-space mask. Start with one representative view and integrate it into the game before creating the remaining visual variants.

## 3. Concrete gameplay rules

### Ship lifecycle

```text
Announced → Arriving → Holding / Inbound → Docking → Servicing
         → Ready to depart → Outbound → Completed
```

- An arrival is announced before spawning into a safe entry area.
- A new ship receives a visible default route toward an available outside holding slot. It never spawns into an unavoidable collision or sails blindly off-screen.
- The player draws a route to a matching berth or holding location.
- Docking uses a short, visible alignment segment; ships must approach with sufficient room and at a safe speed.
- A dock remains occupied during service and while its ship is ready to depart.
- Service completion produces a clear ready indicator, not an unexpected automatic departure.
- The player draws a departure route to the exit. A ready ship can wait at its berth until passage is available.
- Berth occupancy clears only when the departing hull clears its defined berth envelope.
- A completed ship is removed only after crossing its designated exit boundary.
- Credit is awarded once, after successful departure. Partial service never counts as a completed delivery.

### Vessels

| Class | Role | Handling | Service | Initial scoring proposal |
| --- | --- | --- | --- | --- |
| Ferry | Frequent, quick turnaround | Smaller hull, tighter turns | Short | 1 completed delivery point |
| Cargo ship | Longer resource commitment | Larger hull, wider turns, slower response | Longer | 3 completed delivery points |

Exact speeds, acceleration, turning limits, service duration, spacing, and arrival rate are tuning parameters. Do not present untested values as realistic maritime simulation. Start with generous clearances and add pressure through scheduling before increasing vessel speed.

### Berths and route reservations

- Each berth accepts one vessel class in v1 and has one physical slot.
- A committed inbound route reserves its compatible berth. Only one vessel may own that reservation.
- Rerouting to a different destination releases the old reservation atomically after the new route is accepted.
- An occupied/reserved destination is visibly unavailable. Reject the new assignment without deleting the ship's existing safe route.
- Drawing to a waiting slot reserves that slot in the same way.
- Docking is permitted only for the matching owner; berth capture cannot consume a passing vessel.
- Ships at berths and waiting areas remain visible physical obstacles.

### Shared entrance channel

Use three clear control states: **Inbound**, **Clearing**, and **Outbound**. Clearing also records which direction will open next.

- For the initial release, admit one vessel into the controlled channel at a time. This keeps safety and reversal rules understandable.
- The channel has explicit entry/exit gates and a tested center route. Drawn routes crossing it snap to that segment in the preview.
- The player's route still controls movement through open water; the constrained channel section is visibly indicated.
- A direction switch stops new admissions. The current vessel clears the entire channel before the opposite gate opens.
- Repeated taps during clearing update the requested direction; they never reverse a vessel or grant conflicting admission.
- Opposing traffic waits at a marked holding position. Departure routes wait at the berth until they can safely enter the approach.
- Admission grants a reservation before a ship leaves its stopping area, preventing it from becoming stranded between the berth and gate.
- Do not allow stopping, rerouting, or anchoring inside the controlled channel. Explain the temporary lock on selection.
- Use a deterministic eligible queue, initially ordered by committed passage request, with stable ship-ID tie-breaking. Show the next eligible vessel.
- Channel admission prevents opposing entry, not every open-water collision. Preview warnings still matter outside the controlled segment.

The first map must be designed so a waiting inbound ship cannot physically block the outbound exit. All later maps must pass the same deadlock and clearance checks.

### Movement and route drawing

- Ship position follows its actual heading and speed; heading has a bounded turn rate and speed has bounded acceleration/deceleration.
- Sample and simplify pointer input, then generate an achievable curve from the ship's current pose and speed.
- Preview and committed movement use the same constraints. A visually accepted route must not become an impossible sharp turn at release.
- Revalidate at release because the ship may have moved during drawing. If no safe route can be committed, keep the old route and explain the rejection.
- Check the entire hull corridor, not only the centerline, against static land and obstacles.
- A route preview can warn about likely traffic conflicts, but must not claim safety against future player changes or unseen arrivals.
- Invalid routes show the problem location and a short reason. Do not automatically reroute around a whole island without showing that change.
- Stop only at defined holding slots or a berth, with visible deceleration. Freeform route endpoints in open water are invalid in v1.
- Pause freezes movement, service, spawns, queues, score timing, and warning timers together.

### Collisions, delays, and fairness

- A hull-to-hull or hull-to-land collision ends a scored run. Practice explains the collision and permits restart without record changes.
- Use swept movement checks or bounded substeps so a ship cannot cross a thin obstacle between updates.
- Routes may be rejected for intersecting static hazards; dynamic conflicts remain part of play.
- Near-miss warnings must appear early enough to be actionable at the current speed.
- Waiting capacity is finite. When it is full, arrivals remain in a visible offshore backlog counter rather than overlapping or spawning unsafely.
- A sustained full backlog advances a clearly labeled congestion meter; relieving it drains the meter. A full meter ends the scored run with a congestion explanation.
- Exact backlog limits and meter timing require playtesting; they are configuration, not hidden behavior.
- Never add an invisible timeout to an individual ship. All urgency must have a visible indicator.
- Record collision/congestion cause and involved vessels in the result snapshot so the player can understand the loss.

## 4. Modes, progression, and content

### Modes

- **Practice:** guided or free practice, forgiving arrival schedule, no score records or progression. Permit route planning while paused here.
- **Shift:** initial target of five active minutes. Stop generating arrivals when the shift clock ends, then allow up to one minute to clear already admitted ships. Show that closing period explicitly; unfinished ships give no completion credit. These timings are provisional playtest settings.
- **Endless:** progressively busier traffic until collision or congestion, with a practical cap on simultaneous visible vessels. Increase scheduling pressure without making the map physically impossible by spawn design.

In scored modes, pausing covers the playfield and disables route editing. Resuming provides a short countdown before all simulation clocks restart.

### Difficulty

Easy, Normal, and Hard share the same rules. Adjust arrival intervals, mix, waiting capacity, and congestion tolerance. Keep steering predictable and avoid changing the apparent meaning of a drawn route between difficulties.

### Maps

| Map, working name | Purpose | Geography and scheduling difference |
| --- | --- | --- |
| Delta Harbor | Tutorial and first finished slice | Broad inner basin, two berths, one short controlled entrance, generous waiting water |
| River Bend | Test planning through geography | Curved approach and an island separating open-water routes; sufficient turning room for both classes |
| Island Port | Later web challenge | Longer shared entrance and berths on different inner shores, creating more competing inbound/outbound requests |

All three use the same tested rules and two vessel classes. Additional maps should add spatial decisions without new simulation subsystems.

### Progression and records

- Unlock Delta Harbor and practice immediately.
- Unlock the next maps through modest cumulative completed deliveries. Initial proposal: 15 deliveries for River Bend and 40 for Island Port; tune against observed session length.
- Keep records separate by map, map-layout variant, mode, difficulty, and gameplay-rules version.
- Save unlock progress when a run resolves, including failure; abandoned runs do not award progression. Explain this on quit.
- Track a small set of milestones: first departure, first completed shift, both vessel classes handled, and all maps played.
- Avoid a currency, upgrade tree, daily streak, or mandatory grind in v1.

## 5. Screens and input

### Required screens

1. Home: start, continue practice/tutorial, settings, short game premise.
2. Map selection: preview, description, unlock state, mode, difficulty, and local best.
3. Tutorial: learn one action at a time in the real playfield.
4. Gameplay: map, score/time, channel direction, backlog, pause, selected-vessel context.
5. Pause: resume, restart, settings, and quit with a clear progress explanation.
6. Results: outcome, deliveries by class, score, personal best, unlocks, and restart.
7. Settings/help: audio, reduced motion, contrast cues, control explanation, data export/import/reset, credits.
8. Loading/error state: asset progress, useful failure message, and retry.

### Tutorial sequence

Select a ferry → draw to its berth → observe service → draw an exit route → switch channel direction → hold an arrival → coordinate one cargo departure. Teach invalid-route feedback in a safe situation. Make the tutorial skippable and replayable.

### Touch and pointer rules

- Enlarge ship hit areas without enlarging the visible hull or collision polygon. Use nearest-hull selection when targets overlap; avoid ambiguous double selection.
- Use at least 44 CSS px as the initial target size for controls and ship selection, then test for accidental input on real phones.
- Capture the active pointer while drawing; release/cancel cleanly on pointer cancellation, loss of focus, pause, or orientation change.
- Prevent browser scrolling only inside the active game interaction surface. Keep surrounding menus usable normally.
- Maintain a clear preview near the finger and show destination validity outside the occluded area.
- Do not require hover, right-click, multi-touch, drag precision at screen edges, or keyboard shortcuts.
- Keyboard users can navigate menus, pause, and operate the channel control. Route drawing remains pointer-based in v1; document that accessibility limitation.
- Use icon/letter pairs with destination colors, visible focus, readable text contrast, and separate music/effects volume.

### Responsive map behavior

- Author portrait and landscape layouts for each map, using common rules but explicit tested coordinates. Do not stretch one coastline to fill every aspect ratio.
- Choose the layout at run start. Map identity and collision geometry stay fixed throughout that run.
- On resize or rotation, pause, preserve simulation state, recompute the viewport transform, and fit the existing world inside the available play area. Use letterboxing where needed.
- A new run may choose the other layout. Never relocate moving ships into a newly generated coastline mid-run.
- Keep HUD controls outside critical water and honor browser safe-area insets.
- If the playfield becomes too small for reliable selection, remain paused with a clear rotate/enlarge message. Define the minimum from touch testing.

## 6. Web architecture and project boundaries

Create the game as a separate application/project when implementation starts. This Air Traffic Control repository currently holds the planning documents and reference code; this plan does not authorize replacing its game or renaming its existing application.

Use the existing familiar stack: TypeScript, Vite, Phaser, and browser-local persistence. Confirm dependency compatibility when scaffolding rather than copying exact versions blindly. Build the web app only; do not include Electron, Capacitor, Gradle, or store scripts in the initial application.

### Proposed modules

```text
src/
  core/
    Simulation.ts          # fixed-step update and ship state transitions
    types.ts               # ships, berths, channel, routes, run snapshots
    movement.ts            # steering and speed constraints
    routing.ts             # route construction and static validation
    collision.ts           # hull and coastline checks
    channel.ts             # direction changes and passage reservations
    traffic.ts             # seeded arrivals, holding slots, congestion
    scoring.ts             # completion records and run outcome
  maps/
    types.ts
    registry.ts
    delta-harbor.ts
    river-bend.ts
    island-port.ts
  game/
    scenes/
    input/
    rendering/
    assets/
  ui/                      # accessible DOM menus and HUD controls
  storage/                 # versioned saves and import/export
  audio/
  main.ts
```

Keep the core independent of Phaser and the DOM. Rendering consumes simulation snapshots/events; UI sends explicit commands. Avoid a general plugin system, custom engine, network service, or shared multi-game framework.

### Reuse assessment

| Existing foundation | Approach |
| --- | --- |
| Fixed-step timing and seeded traffic | Adapt the pattern; keep seed and input sequence reproducible |
| Route sampling and pointer interaction | Reuse suitable pieces after checking their assumptions |
| Aircraft movement | Replace: current position follows a polyline while visible heading turns afterward |
| Runway landing behavior | Replace with berth reservation, service, and outbound lifecycle |
| Terrain/render separation | Reuse the principle; use harbor map contracts |
| Menus, audio preferences, pause patterns | Adapt styling and lifecycle behavior |
| IndexedDB persistence | Adapt with new namespace and schema; never read/write aircraft saves as harbor saves |
| Existing native wrappers | Leave out until explicitly requested later |

The movement and landing limitations are verified in [the current simulation](../src/core/Simulation.ts). The web/native tooling currently used by the reference project is declared in [package.json](../package.json).

### Core contracts

- Stable IDs for ships, berths, waiting slots, and channel reservations.
- Commands such as `assignRoute`, `requestChannelDirection`, `pause`, `resume`, and `restart` return explicit acceptance or rejection reasons.
- A simulation-owned clock drives every gameplay duration. Browser timers never control service or channel clearance.
- Fixed simulation steps are independent of display refresh rate. Clamp excessive elapsed time; backgrounding pauses rather than fast-forwarding the harbor.
- Debug snapshots include seed, elapsed time, ships, reservations, queue order, channel phase, score, and congestion.
- Layout validators confirm that all docks, waiting slots, corridor segments, and exits are reachable for the largest vessel before a map is accepted.
- Collision outlines, playable geometry, and asset overlays can be toggled in development for visual inspection.

## 7. Persistence, offline behavior, and deployment

### Saves

- Versioned local schema for preferences, tutorial status, unlocks, achievements, and records.
- Use atomic writes where possible and save run results exactly once.
- Persist preferences when changed and results when a run resolves. Do not depend on page-unload callbacks.
- Keep v1 active runs in memory; refreshing closes the unfinished run. Clearly state this behavior. Suspend/resume within the same live page is supported.
- Handle missing, corrupt, or unavailable storage with a usable in-memory fallback and a small explanation that records may not persist.
- Provide JSON export/import with schema validation and size limits. Reject malformed imports without replacing valid local data.
- Require an explicit reset action for deleting records.

### Offline/install behavior

- Add a web app manifest and service worker after the basic web loop is stable.
- Cache the app shell, first map, vessel assets, and essential audio; avoid shipping source art.
- Cache additional maps as they are downloaded and show whether each is ready offline. Allow the player to download all maps explicitly.
- Display offline readiness only after the required assets have been verified in cache.
- First use requires a successful online download. Uncached maps remain clearly unavailable offline.
- Defer activating an updated service worker/reloading until the run has ended or the player accepts from a menu. Never reload during play.
- Test version changes and cache cleanup with real old/new production builds.

### Production delivery

- Static production build with documented build and preview commands.
- Correct asset paths for the chosen hosting base URL; verify route refresh behavior.
- HTTPS hosting for the deployed web game.
- Correct title, description, app icon, manifest, credits, and social preview metadata.
- No inherited aircraft names, package identifiers, store links, donation flows, or save keys.
- Stage a shareable web preview, then publish to the selected production destination when that destination is supplied. This planning task does not publish anything.
- Document how to redeploy the previous build and how versioned saves behave across a rollback.

## 8. Milestones and completion gates

Execute in this order. Each milestone produces something inspectable; later content work depends on the earlier gameplay gates.

| Milestone | Work | Concrete completion gate |
| --- | --- | --- |
| M0 — Identity and specification | Choose working project identity, create separate web app, record rules and art brief | Web scaffold starts; correct harbor identity; no native dependencies |
| M1 — Graybox layout and movement | One simple map, two hulls, route preview, real turning, land boundaries | Both classes can reach and leave every intended berth without impossible turns |
| M2 — Complete graybox loop | Reservations, service, departures, channel reversal, holding, arrivals, collision/congestion | A full shift runs; no conflicting reservations or invisible queue behavior |
| M3 — Art production and integration | Generate style concept, produce first-map assets and vessels, integrate against masks | Art aligns with geometry; ships/routes remain clear on phone and desktop |
| M4 — Finished first harbor | Menus, tutorial, results, audio, settings, touch polish, local saves | A new player completes the tutorial and a shift without verbal help |
| M5 — Full web content | Two additional maps and variants, difficulty presets, endless/practice, progression | All routes/layouts tested; every map adds an understandable scheduling challenge |
| M6 — Browser delivery | Offline/install support, loading/recovery, production metadata, asset optimization | Cached game runs offline; update cannot interrupt an active run |
| M7 — Verification and balancing | Automated invariants, browser/device sessions, accessibility, performance, congestion tuning | Acceptance checklist passes or limitations are explicitly documented |
| M8 — Web review | Deploy/share chosen preview, collect user feedback, implement corrections | User is satisfied with web gameplay, artwork, controls, and content |

Only after M8 and a follow-up request should an Android or desktop plan be executed. Packaging code is not a prerequisite for any web milestone.

## 9. Verification plan

### Meaningful automated coverage

Test behavior and failure modes rather than sprite counts or implementation details:

- Heading/speed limits hold and routes respect hull clearance.
- Invalid rerouting preserves the previous route and reservations.
- Two simultaneous requests cannot reserve the same berth or waiting slot.
- Service advances only while running; ready ships remain until dispatched.
- Berth release occurs after hull clearance; score increments exactly once on exit.
- A direction request blocks new admissions and waits for full channel clearance.
- Repeated direction requests cannot create conflicting reservations or strand channel occupants.
- Fixed seed plus commands produces the same outcome at different rendering frame rates.
- Thin obstacles and fast motion cannot be skipped by collision detection.
- Full holding capacity creates visible backlog, not overlapping ships; congestion recovery works.
- Shift closeout stops arrivals and resolves records once.
- Save import rejects invalid data; migration preserves existing records.
- Resize, pointer cancellation, hidden tabs, and restart cannot leave stuck selections or stale reservations.

Browser end-to-end coverage should complete one real delivery, a direction reversal, a full short test shift, a save/reload cycle, and an offline reopening of cached content. Use controlled traffic seeds rather than timing-sensitive random runs.

### Manual browser/device matrix

- Current desktop Chrome/Edge, Firefox, and Safari where available.
- Android Chrome on a physical lower-powered phone as well as a representative modern phone.
- iPhone/iPad Safari for the web version where available; this is browser testing, not a native iOS release.
- Mouse, touch, pen when available, keyboard menus, portrait, landscape, narrow desktop windows, and high-density displays.
- Slow loading, missing asset, offline startup, unavailable storage, background/resume, orientation change, repeated restart, and production update.

Record unavailable device/browser coverage rather than claiming it passed. Emulation supplements but does not replace physical touch testing.

### Initial performance budgets

These are engineering targets, not measured current performance:

- Aim for smooth 60 fps on typical hardware, with a usable 30 fps floor on the chosen lower-powered test phone at the configured vessel cap.
- Initial compressed transfer target: at most 5 MB for app shell, first map, vessels, and essential sound. Lazy-load other maps and optional audio.
- Do not decode full-resolution art sources in the browser. Start with terrain textures capped around 2048 px per dimension and reduce on constrained devices if visual QA allows.
- Cap particle/wake counts and device pixel ratio; cache static terrain instead of repainting it every frame.
- Target no increasing memory trend across 20 restart cycles and a 30-minute endurance session. Investigate retained scenes, textures, audio nodes, and pointer listeners.
- Profile on devices and record actual results before widening the budgets.

### Playtest questions

- Can a new player identify a ship's destination without depending on color?
- Can they explain why a ship is waiting and how to release it?
- Does channel control create decisions rather than repetitive tapping?
- Do large ships feel deliberate without feeling unresponsive?
- Can they explain a collision from what they saw?
- Is the first successful departure satisfying, and do they choose another run?

Start with a small observed playtest, such as five people, and record specific misunderstandings. Treat it as qualitative feedback, not proof of broad market demand.

## 10. Risks and planned responses

| Risk | Response |
| --- | --- |
| Attractive map is unplayable | Validate graybox clearance first; geometry owns art placement |
| Generated shoreline disagrees with collisions | Use masks/material composition and inspect debug overlays |
| Handling feels unfair | Share route-preview and movement constraints; test wide turns before adding traffic |
| Channel and dock queues deadlock | Explicit reservations, separated holding water, one channel occupant, adversarial seeded tests |
| Too much waiting | Tune service times and arrival mix; show all timers; test decision frequency |
| Touch controls obscure boats | Generous selection, clear preview, separated HUD, actual-phone playtests |
| New game inherits aircraft assumptions | Adapt infrastructure deliberately; implement a separate harbor domain model |
| Feature growth delays a playable game | Complete the first harbor before additional maps, weather, construction, or platform work |
| Offline/update behavior loses a run | Deferred updates, all gameplay clocks paused together, explicit unfinished-run policy |
| Name resembles an existing release | Choose and check a distinct final title before public branding |

## 11. Definition of web complete

- [ ] Separate harbor application with a distinct release identity.
- [ ] Three coherent maps with verified portrait/landscape layouts.
- [ ] Two vessel classes with predictable, visible movement constraints.
- [ ] Arrival, reservation, service, departure, and channel scheduling rules work together.
- [ ] Practice, timed shift, endless mode, difficulty, progression, and local records work.
- [ ] Finished map/vessel assets match collision geometry and have documented provenance.
- [ ] Tutorial, pause, results, settings, loading, errors, credits, and save export/import are complete.
- [ ] Mouse/touch interactions and keyboard-accessible menus are verified.
- [ ] Offline readiness, install behavior, and deferred updates are verified with production builds.
- [ ] Functional tests, type checks, production build, browser sessions, and performance checks have recorded results.
- [ ] Public preview/deployment uses the intended title, assets, links, and metadata.
- [ ] User feedback on the web version has been addressed and the user is satisfied.
- [ ] Android and desktop work remains deferred until requested after web acceptance.

## References and evidence

- [Harbor game research](harbor-master-research.md): primary-source comparison and limitations, dated 2026-10-04.
- [Current simulation](../src/core/Simulation.ts): fixed-step timing, route-following, and aircraft landing assumptions.
- [Current package configuration](../package.json): existing reference-project tools.
- [River Bend generated-art record](../art/visual-v2/river-bend/README.md): historical art/operational-layer separation.
- [Current presentation asset loader](../src/game/assets/presentationAssets.ts) and [asset simplification](arcade-asset-simplification.md): current materials and rendering approach.
- [Phaser input documentation](https://docs.phaser.io/phaser/concepts/input): unified pointer input, as verified during the preceding research.

Everything labeled proposed, initial, target, or working is a design decision for implementation and playtesting, not a claim about an existing finished harbor game.
