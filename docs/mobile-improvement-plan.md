# Mobile gameplay improvement plan

Status: implemented locally on 2026-09-29; automated and browser verification complete within the coverage recorded in [mobile verification](mobile-verification.md). Physical-device acceptance and publication remain pending.

Based on the [independent mobile UI/UX and QA review](../.impeccable/critique/2026-09-29T14-57-10Z__src-game-scenes-playscene-ts.md).

## Outcome

Make aircraft feel proportionate to phone-sized airfields, keep them easy to select and route with a finger, and preserve an active shift through ordinary viewport changes. Retain the existing visual identity, maps, saved progress, and desktop experience.

The review confirmed a height-only resize interruption and found competing scale rules in source. It did not establish physical-phone touch accuracy or performance. Those remain verification tasks, not assumed defects.

## 1. Establish a reproducible baseline

- Capture live aircraft, selected aircraft, a drawn route, and runway/helipad approach at 320×568, 360×640, 390×844, 430×932, and 844×390. Include a tablet and 1280×800 desktop control.
- Use a deterministic test scenario for all three aircraft types so before/after comparisons use the same positions and headings. Keep any fixture test-only and independent of career saves.
- Record aircraft footprint, selection boundary, runway width, helipad diameter, and HUD bounds. Check all nine map layouts; use Saltmarsh and River Bend for the detailed interaction pass.
- Add a regression reproducing 390×844 → 390×780 during a shift, including an existing route and nonzero score. Capture the current forced-restart failure before changing it.
- Add selection cases at the visible nose, tail, and wing edges, with both mouse and coarse-pointer input.

Acceptance: failures are reproducible, screenshots show fully visible aircraft, and background-rendering failures are recorded rather than treated as product evidence.

## 2. Rework aircraft scale and selection together

Primary files: `src/game/rendering/aircraft/visualTokens.ts`, `src/game/rendering/AircraftView.ts`, `src/game/scenes/PlayScene.ts`, and the associated visual/collision tests.

### Proposed visual direction

- Start with mobile major-axis targets of **48px airliner, 44px commuter, and 44px helicopter** at a typical 390px-wide playfield, compared with the current 76/68/70px. These are prototype values, not established final sizes.
- Base adaptation on the rendered playfield's shorter dimension so landscape phones receive the same treatment. Transition smoothly toward existing desktop sizes; do not enlarge everything abruptly at one breakpoint.
- Inspect these values against runway and helipad geometry on every map. Preserve aircraft class recognition, strong outlines, livery colors, and selection feedback. Do not enlarge airport geometry solely to hide a scale mismatch.
- Choose the final size in one comparison pass, then one confirmation pass. Keep full-size desktop sizing unchanged unless a demonstrated regression requires adjustment.

### Interaction and collision rules

- Separate the touch target from the visible sprite. Use at least a 44px target diameter and enough additional margin to include the displayed nose, tail, and wings. Convert CSS-pixel margins into world units through the actual canvas transform.
- Keep mouse selection precise while including the complete visible aircraft. Continue resolving overlapping selectable targets predictably by nearest aircraft; test closely spaced aircraft.
- Keep fatal collision outlines aligned with visible solid airframes. Touch padding, selection halos, shadows, and rotor blur must not become collision surfaces.
- Set the world-space visual/collision scale at shift start and retain it through harmless resizes. Recompute input coordinate conversion and CSS-sized touch margins as the display changes.
- Recheck warning lead distance, landing capture, route guidance, and difficulty because smaller visible/collision bodies alter separation margins. Do not silently change traffic speeds or spawn rates; propose any necessary balance adjustment separately.

Acceptance: all visible solid-airframe points are selectable, a finger can acquire and reroute aircraft, collisions still correspond to visible contact, and mobile screenshots show an intentional aircraft-to-airfield hierarchy.

## 3. Preserve shifts through same-orientation resizes

Primary files: `src/main.ts`, `src/game/viewport.ts`, Phaser canvas setup, and viewport regression tests.

- Replace the exact-dimension comparison used to decide whether a shift must restart with a distinction between **display resizing** and **changing the logical map layout**.
- Preserve the active simulation's world dimensions, aircraft positions, routes, score, difficulty, elapsed simulation time, and career accounting during same-orientation changes.
- Scale the existing world into the available viewport without cropping interactive content or regenerating the map. A small temporary margin is preferable to destroying a shift. Rebuild the map to the new viewport when the next shift begins.
- Verify how Phaser's current `EXPAND` mode changes logical dimensions before selecting the concrete scale-manager configuration. Merely removing the restart check is insufficient: rendering, input transforms, and simulation geometry must agree.
- On resize during a drag, cancel only the unfinished drawing gesture and retain the aircraft's existing assigned route. A protective pause may remain, but **Resume** must continue that shift at the new size without discard confirmation.
- For this first release, retain explicit restart confirmation for a real portrait/landscape layout switch. Returning to the original orientation should allow the preserved shift to resume without requiring exact original pixel dimensions.
- Replace “Rotate back” with context-appropriate text; reserve rotation wording for an actual orientation change. Do not reset simulation state when only the detail-level classification changes.

Acceptance: 390×844 → 390×780 → 390×844 preserves the same shift and permits Resume at every step. Repeated changes create no duplicate score/career events, route jumps, collision jumps, or stuck pointer state.

## 4. Refine mobile help and landscape home

Primary files: `index.html`, `src/styles.css`, and `src/ui/practice.ts` only if behavior needs adjustment.

- Place “Try a practice flight” near the top of Help, visible in the first normal-text viewport at 390×844. Keep the illustrated steps below as reference and retain access after scrolling.
- Restore a compact selected-airfield preview on short landscape home screens. Keep Play, difficulty, airfield selection, and navigation reachable; the preview must not crowd primary controls.
- Keep controls at least 44px in each touch dimension, allow text and actions to wrap, and use vertical scrolling where needed instead of clipping content.
- Check safe-area insets around HUD, pause, and primary controls. Fix only demonstrated overlap or missing inset handling.
- Preserve current typography, colors, and screen structure. A navigation redesign is outside this scope.

Acceptance: no horizontal overflow at 320px, practice is easier to discover, and the landscape preview is visible without sacrificing usable controls. Large-text mode remains usable even where scrolling is necessary.

## 5. Validate independently and prepare release

### Automated checks

- Replace tests that demand the current oversized mobile footprint with agreed size bounds, mobile-to-desktop transition checks, and stable logical scaling during a shift.
- Test silhouette-edge selection, coarse-pointer minimum target size, target overlap resolution, collision consistency, warning-before-contact behavior, and all map landing targets.
- Exercise same-orientation resize, rotation and return, resize while drawing, repeated resize, and pause/resume without loss of run identity or score.
- Run the full test suite, web production build, desktop build, and existing desktop smoke test. Desktop cursor behavior must remain intact.

### UI/UX acceptance pass

Compare before/after screenshots with aircraft near their destinations. Review proportions, legibility, route endpoint visibility, selection feedback, and practice discovery separately from functional test results.

### QA acceptance pass

On a real iPhone with Safari and an Android phone with Chrome, verify successful landings for all aircraft classes, rerouting, nearby-aircraft selection, touch cancellation, browser-toolbar expansion/collapse, rotation, background/foreground recovery, and safe areas. Exercise all difficulties and inspect all nine map layouts. Check an older Android device for sustained frame pacing if available.

If real devices are unavailable, report that gap explicitly; viewport simulation does not complete physical-device acceptance. Record performance observations without asserting that the current app has a proven performance defect.

## Suggested commits and delivery order

1. `test: reproduce mobile selection and viewport resize issues`
2. `fix: balance mobile aircraft scale and touch selection`
3. `fix: preserve active shifts through viewport resizing`
4. `ui: improve mobile practice discovery and landscape preview`
5. `docs: record mobile verification and remaining device coverage`

Implement phases 1–3 first, then phase 4. Keep independent UI/UX and QA sign-off for phase 5. Preserve existing saves and identifiers; no save migration is expected. Store screenshots and release notes may need refreshing after visual approval. Building a candidate is part of verification; publishing a website or a new Snap revision is a separate release step.

## Decisions carried by this proposal

- Begin with 48/44/44px mobile aircraft prototypes and keep generous independent touch targets.
- Preserve same-orientation shifts; retain the explicit new-layout decision on rotation for now.
- Preserve current desktop sizing and visual identity.
- Avoid traffic/difficulty changes until the scale and collision review demonstrates a need.
- Do not claim physical-phone acceptance until it has actually been performed.
