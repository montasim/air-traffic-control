# Preserve active shifts through screen resizing

Date: 2026-09-30

Status: implementation complete on 2026-09-30 for the fixed-world resize/resume scope below. Full airfield rearrangement remains explicitly out of scope.

## Implementation record

Delivered:

- Active shifts retain their simulation, world geometry, aircraft, committed routes, run identity, score, difficulty, and starting-orientation record scope through resizing.
- Orientation crossings, cumulative changes of at least 20%, and unusable field sizes pause immediately. Resume waits for 160 ms of stable sizing and explicit player input.
- Resume button, Escape, and HUD resume share the same post-audio-unlock checks for size, settlement, visibility, modal dialogs, and utility screens.
- Partial route strokes are cancelled while committed routes survive. Phaser's existing FIT transform and screen-space selection radius remain sufficient; no coordinate remapping or collision changes were needed.
- Pause copy, disabled-state explanation, live status, focus fallback, and starting-orientation context are implemented. Existing scrollable pause-panel CSS and viewport-anchored HUD passed visual checks; no CSS changes were needed.
- New shifts rebuild for the current viewport. Existing records and save format remain compatible.
- Added read-only development diagnostics and reusable browser regression scripts. No live simulation mutation API is exposed.

Verification completed:

| Check | Result |
| --- | --- |
| `npm test` | 30 test files, 326 tests passed, including resize policy boundaries and deterministic routed-flight pause/resume without traffic catch-up |
| `npm run build` | Type checking and production/PWA build passed |
| `npm run build:desktop` and `npm run test:desktop` | Passed; desktop smoke now covers cross-orientation resume with stable canvas world dimensions and score |
| `npm run test:resize` | Passed: committed-route continuity, unchanged paused snapshot, post-fit pointer alignment, interrupted replacement stroke, manual resume, asynchronous unlock race, tiny-window keyboard guard, utility/dialog preservation, cumulative resize, new-shift orientation, phone rotation recovery, and browser-chrome height changes |
| `npm run test:resize:maps` | Passed all nine maps with both starting orientations: 18 state-continuity, fit, aspect-ratio, and resume checks |
| Visual review | Reviewed all 18 resumed-field screenshots and the narrow pause dialog; full fields remain visible, landing targets are unobscured, and recovery controls are reachable |

Run the browser scripts against a development server (`npm run dev -- --port 4287`). Set `RESIZE_TEST_URL` for another address and `CHROME_PATH` for another Chrome executable. Each script uses an isolated browser profile. The map matrix seeds only its disposable test profile. Screenshots are written under `test-results/`.

Accepted boundary: retain the conservative 240 CSS-pixel minimum fitted short side. A 390×844 portrait shift fitted into 844×390 is below that threshold, so it remains paused with recovery instructions; returning to portrait restores Resume and preserves the same shift. This is the intended small-field fallback, not an automatic restart. The feature primarily improves window resizing and orientation changes with sufficient display space.

Verification limits: browser automation used desktop Chrome with Canvas rendering for reliable headless execution on this host, plus Electron's normal renderer. Physical touch/pen devices, real mobile browser chrome, screen-reader announcement quality, and browser zoom were not manually certified. The completed rotated-shift save path retains its original profile and existing storage tests cover record accounting; a scoring rotated shift was not played to completion in the browser. These are explicit coverage boundaries, not claims of completed device testing.

The sections below retain the implementation specification and future validation matrix for reference.

## Outcome and scope

Players can resize their browser or switch between portrait and landscape, then resume the same shift. Keep aircraft, assigned routes, landing targets, score, elapsed simulation time, traffic scheduling, difficulty, progression evidence, and run identity intact.

Use the existing airfield geometry for the lifetime of a shift and uniformly fit it into the available screen. Controls respond to the new screen dimensions. Empty space around the airfield is acceptable; stretching, cropping active airspace, and rearranging runways are not.

This first version does not rebuild an active map into its other orientation, migrate simulation coordinates, add camera panning or zooming, or save active shifts across page reloads. A newly started shift still uses a fresh layout suited to the current screen.

## Current implementation

- `src/game/viewport.ts` chooses portrait/landscape profiles and expands the initial world to fill the starting viewport. `requiresNewLayout()` currently treats orientation changes as requiring a new layout.
- `src/main.ts` creates Phaser with `Scale.FIT` and `CENTER_BOTH`. The resize listener cancels an unfinished route stroke and evaluates orientation after a 160 ms debounce.
- On orientation changes, the listener pauses play and changes Resume into “Start in portrait/landscape.” `resumeRun()` requests confirmation before destroying the game and starting another shift.
- `PlayScene` builds map geometry, collision scales, and its simulation at scene creation. Its existing pause/resume methods preserve the simulation instance.
- Records and completed-shift evidence use `activeProfile.id`. Preserve that starting orientation during a resumed shift.
- `tests/game/viewport.test.ts` covers the current orientation rule. `scripts/test-desktop.mjs` verifies same-orientation resize/resume but not orientation changes.

## Interaction contract

| Situation | Required behavior |
| --- | --- |
| Small same-orientation resize | Fit the canvas; continue playing if usable. Cancel an unfinished stroke while keeping its previously committed route. |
| Orientation changes during play | Pause immediately when the crossing is detected; fit the existing world; wait for explicit Resume. |
| Large same-orientation resize | Pause when either screen dimension changes by at least 20% from the last accepted playing viewport. Treat 20% as an initial tuning value. |
| Repeated resize events | Remain paused; update presentation without creating more dialogs, restarting, or repeatedly moving focus. |
| Resize while already paused | Preserve pause state and refresh the notice and resume availability. |
| Return to original dimensions | Remain paused until the player resumes. |
| Screen becomes too small | Pause; explain why Resume is unavailable; retain the shift. Enlarging the screen restores availability but does not resume automatically. |
| Resize in settings/help or an open confirmation | Preserve the current surface; update the underlying resize state without replacing the dialog or moving focus. |
| Resize on home/results | Do not resume a simulation or overwrite results. Prepare the next shift for the current viewport through the existing start/rebuild flow. |

While paused after resizing, show the fitted field behind the existing pause panel and use:

> Screen size changed. Your shift is paused and ready to continue.

Primary action: **Resume**. Use that label consistently for ordinary pauses too. Keep Restart available as an explicit, confirmed abandonment action; resizing itself must never invoke it.

For an unusably small field:

> The airfield is too small to play comfortably. Enlarge the window or rotate your device to continue this shift.

Preserve Main menu and existing confirmation behavior. Explain on relevant record surfaces that orientation records refer to the layout in which the shift started.

## Implementation sequence

### 1. Define resize policy independently of simulation geometry

Update `src/game/viewport.ts` with small pure helpers for fitted display dimensions and resize pause decisions. Keep `worldSizeForViewport()` as an initialization-only operation.

Use actual available container dimensions for fitting calculations. With fixed world dimensions `W × H` and available display dimensions `w × h`, scale is `min(w / W, h / H)` and the fitted field is `W × scale` by `H × scale`.

Track the last accepted playing viewport separately from the shift's starting profile. Set this baseline at shift start and after a successful manual resume. Comparing against that baseline catches a substantial cumulative resize even if each individual event is small. Do not compare every resize against the immediately preceding event.

Adopt a provisional minimum fitted short side of 240 CSS pixels, plus a requirement that essential controls remain reachable. Validate this threshold against aircraft selection and route drawing before shipping; increase it if play is unreliable. Judge the fitted field, not just the browser's width. Device pixel ratio must not affect this CSS-pixel threshold.

Rename or narrow `requiresNewLayout()` so it expresses selection of a layout for a new shift, rather than forbidding resume. Remove it if its remaining callers no longer need it; do not change it to an unconditional false return.

### 2. Preserve the active game and pause safely

In `src/main.ts`:

- Remove the orientation-driven rebuild/abandon branch from `resumeRun()`.
- Keep `game`, `PlayScene`, the simulation, `activeRunId`, `activeProfile`, and active difficulty unchanged during resizing and resuming.
- Cancel in-progress drawing on resize using the existing cancellation behavior.
- Detect a qualifying resize on the event that crosses the policy threshold and pause immediately. Keep the existing debounce for settled presentation updates, not for delaying a safety pause.
- Make repeated resize events idempotent. Allow the existing Phaser FIT behavior to update the display; verify its input transform before adding any explicit scale refresh.
- Route button, Escape, and HUD/keyboard resume actions through one guarded `resumeRun()` path. Check phase, current dimensions, resize settlement, and any open modal/utility surface before resuming, including after `audio.unlock()` resolves.
- Keep Resume unavailable while a qualifying resize is still settling, then reevaluate after 160 ms without a resize event. Small resizes that do not pause play do not introduce a resume gate.
- Ensure pausing from resize does not replace an already open utility screen or confirmation dialog. Existing manual pause and background-tab pause must also remain intact.
- Reset resize-related UI state and pending timers at shift start and game rebuild. A stale timeout must not affect a replacement scene.

Do not call `beginRun()`, `startRun()`, `rebuildForTarget()`, `game.destroy()`, or map preparation from the active-shift resize/resume path. Preserve normal new-shift and map-selection rebuilding, including after a resized shift ends.

### 3. Adapt pause UI and controls

Update `index.html`, `src/styles.css`, and `updateResizeNotice()` in `src/main.ts`:

- Replace the restart-oriented notice and dynamic “Start in …” resume labels with the interaction contract above.
- Keep a paused preview visible where space allows. Make pause controls scrollable/reachable on short screens without exposing background game input.
- Keep keyboard focus stable while dragging a window. Announce a resize pause or a change in resume availability once, rather than on every event.
- Verify DOM HUD placement against the fitted canvas and existing exclusion zones. If controls obscure playable targets after fitting, adjust their display positioning without changing world geometry or collision behavior.
- Show a clear reason when Resume is disabled; keyboard shortcuts must obey the same restriction.

### 4. Preserve record semantics and drawing accuracy

Keep scores associated with the shift's initial layout orientation, even after the screen rotates. Do not update `activeProfile` to the current screen during resume, and do not create a save-schema migration.

Inspect `PlayScene.pointerPoint()` and `precisionFor()` under letterboxing. Verify that selection, route previews, and committed routes use Phaser's updated display-to-world transform. Preserve collision radii and aircraft presentation geometry for the shift; recalculating simulation collision scales would change gameplay. Any pointer precision correction must affect interaction only.

## Verification

### Automated checks to add or update

1. Viewport policy tests: uniform fitting, unused margins, orientation crossings, cumulative 20% changes, insignificant height changes, and the minimum fitted-size boundary.
2. State-continuity coverage through an appropriate integration seam: with aircraft and a committed route present, resize/pause/resume retains run ID, world dimensions, aircraft identity/position/route, score, timing state, and shift evidence. Assert the same simulation continues; checking a zero score alone is insufficient.
3. Verify that time spent paused causes neither aircraft movement nor a burst of overdue traffic on resume.
4. Browser coverage: portrait → landscape → portrait; same-orientation substantial resize; too-small → usable; resize during a route stroke; repeated orientation crossings; manual pause and utility/dialog preservation.
5. Verify every resume entry point respects a too-small or unsettled viewport, including a resize during asynchronous audio unlock.
6. Confirm that a completed rotated shift is recorded once under its starting orientation, and that the next new shift uses the current screen's layout.
7. Extend the existing desktop smoke check for cross-orientation resizing if the Electron window's minimum dimensions permit it. Retain the same-orientation regression check and update its expected button label.

Use existing test infrastructure. Add a small browser test entry point if needed; avoid exposing mutable production simulation state solely for tests. Prefer controlled fixtures or a read-only test seam for continuity assertions.

### Manual usability matrix

- Desktop: 1280×800 → 800×1000 → 1280×800; slow window dragging; resizing with a browser side panel.
- Mobile: 390×844 ↔ 844×390; browser chrome height changes; touch route drawing after fitting.
- Boundary: narrow portrait and short landscape windows, minimum supported browser width, and fitted field sizes on either side of the usability threshold.
- Accessibility: keyboard-only resume/restart, stable focus, announcement frequency, reachable pause controls, and browser zoom.
- Maps: visually check all nine airfields in both starting orientations, with particular attention to targets near HUD controls. Exercise mouse and physical touch where available.

Run `npm test` and `npm run build`; run `npm run test:desktop` when the desktop environment is available. Report any physical-device or browser coverage that could not be completed rather than treating automated viewport emulation as equivalent.

## Completion criteria

- A playable resize never requires abandoning the current shift.
- A qualifying resize pauses before further simulation updates and never resumes automatically.
- Resume continues the same simulation with unchanged geometry, routes, score, difficulty, and record attribution.
- The entire airfield remains visible without stretching, and route drawing remains aligned with aircraft and landing targets.
- Tiny windows receive a recoverable pause state; enlarging restores Resume.
- Home, results, confirmations, utility screens, and ordinary new-shift flows still work.
- The fitted-size threshold passes practical selection/readability checks. If fitting is too small for a common orientation change, document that limitation and reassess the UX before shipping; do not silently substitute a rebuilt map.

## Deferred follow-up

A future version could reconstruct the airfield for the new aspect ratio. That requires a separate design for mapping aircraft and routes, retaining valid runway approaches, preventing new collisions, and keeping score difficulty fair. It is not a prerequisite for preserving shifts with the fixed-world approach.
