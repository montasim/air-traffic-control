# Optional two-end runway landing — implementation plan

Status: implemented and verified.

## Completion record

- Implemented the saved, default-off option as an accessible **switch**, following the user's UI correction. It remembers an explicit selection; it does not automatically enable itself.
- Original-only and two-end preparation share the same occupancy rules and normal proximity landing. Reverse targets and their guidance are absent when off. All nine maps support both modes.
- Bound each scene/shift to its mode; setup changes rebuild the idle scene with Play disabled during the transition. Keyboard focus returns to the switch after rebuilding.
- Updated practice, onboarding, help, pause/result context, and README. Records and career progress remain shared. Existing saved records are preserved.
- Fixed a practice-flight defect uncovered by browser testing: spreading a DOMPoint discarded its coordinate accessors and produced invalid flight positions. Pointer coordinates are now copied to plain points; actual practice flights complete in both modes.
- No career-reset UI exists in the current app. The existing default-save/reset path resets the option to false and is covered by storage tests; no extra reset interface was introduced.

Validation completed:

- `npm test`: **414 tests passed in 34 files**, including save migration/persistence/failure handling and both map modes at four shapes on all nine airfields.
- `npm run build` and `npm run build:desktop`: passed.
- `npm run test:runway-mode`: passed default-off, keyboard switch, focus retention, original practice landing, disabled practice-end rejection, enabled reverse practice landing, repeated toggles, reload persistence, restart, map switch, narrow layout, and frozen mode through resize/resume.
- `RESIZE_TEST_URL=http://localhost:5173/ SKIP_RESIZE=1 APPROACH_MODE=direct npm run test:runway-ends`: both original and reverse ends landed and scored for commuters and liners with the option enabled through the UI.
- Single-end browser cases (`TWO_END_LANDING=0`): original commuter/liner targets landed; aircraft passed through the disabled reverse targets without landing. Disabled-end tests use a route that avoids the still-active original target.
- `RESIZE_TEST_URL=http://localhost:5173/ npm run test:resize:maps`: all **18 map/orientation cases** passed.
- `npm run test:desktop`: verified desktop boot, gameplay, resize/resume and saved settings across restart.
- Visually inspected `test-results/runway-mode/setup-mobile.png` at 360×740: switch and text fit, default off, no horizontal overflow.

The sections below describe the completed implementation scope.

## Agreed behavior

- Add “Land at both runway ends” directly below Easy / Medium / Hard on the Play screen, as a separate setting rather than another difficulty level.
- Default off for new players and existing saves that have not explicitly enabled it.
- Off: only the original authored landing target of each runway is available.
- On: both original and reverse targets are available on every airfield.
- Both modes use normal proximity landing. Aircraft do not need a particular approach angle. The aircraft must physically reach the selected matching landing area; drawing a route does not land it immediately.
- Preserve shared runway occupancy and busy warnings in both modes. Busy aircraft continue flying and need rerouting; no automatic holding is introduced.
- Preserve helipad behavior, traffic difficulty, aircraft speeds, collision rules, and runway artwork.
- Remember the setting across app launches. Freeze the choice for each shift, including pause/resume, resizing and orientation changes.

## 1. Persist the preference

Files: `src/storage/gameSave.ts`, `src/storage/gameStore.ts`, and their tests.

- Add `settings.twoEndLanding: boolean`, default false.
- Normalize only a literal boolean true to enabled; missing or malformed values fall back to false. Migrate all supported legacy saves without losing scores, achievements, audio settings, or selected difficulty/map.
- Use an additive field in the current schema rather than restructuring saved records. Update normalization, cloning and reset paths so the preference survives unrelated writes and resets to false on an explicit career reset.
- Add a store setter using the existing serialized persistence mechanism. Follow the existing save-error behavior, including in-memory continuity if storage fails.
- Test fresh saves, old saves, invalid values, reload persistence, changing audio/difficulty without losing the preference, and reset.

## 2. Make map preparation mode-aware

Files: `src/game/maps/types.ts`, `src/game/maps/shared/definition.ts`, `src/game/maps/shared/bidirectional.ts`.

- Add an optional `twoEndLanding` preparation input with a false default; pass the value explicitly from the live game.
- Prepare the original runway target with its existing end-0 identity and shared-runway metadata in both modes. Add the mirrored target and its guidance surface only when enabled.
- Keep original target IDs stable. When disabled, omit reverse targets from the playable landing-zone list and matching guidance list—not merely from rendering.
- Preserve the reservation metadata on original targets so single-end mode keeps occupancy behavior.
- Ensure rendered markers, pointer snapping, simulation capture, and spawn exclusion all consume the same prepared target set.
- Retain the existing per-map scenery and geometry; do not duplicate or redraw the physical runway.
- Test all nine maps in portrait, landscape, square and wide shapes: one versus two targets per runway, unchanged pads, unique IDs, matching guidance, and original-end capture from arbitrary angles.

## 3. Bind the mode to a shift

Files: `src/main.ts`, `src/game/scenes/PlayScene.ts`.

- Separate the saved preference for the next shift from the immutable mode used by the current scene/shift.
- Pass the mode through game/scene construction, preload preparation, and final map preparation. Do not let those calls disagree.
- On the Play screen, changing the setting updates the saved choice and rebuilds the idle scene as necessary. Serialize changes or keep Play disabled while rebuilding so rapid toggles cannot start a shift with stale targets.
- A new shift and Play Again use the selected preference. An active shift retains its mode through resume, visibility changes, resize and dialogs.
- Keep the control on the Play screen; do not add a mid-shift mode switch. Follow existing abandon confirmation if returning to Play would discard a paused shift.
- Include the active mode in detached development snapshots and pause/result context, using concise labels “One landing end” / “Both landing ends.”
- Test toggle-before-start, repeated toggles, restart, switching maps, and resuming a resized shift.

## 4. Add clear setup and teaching UI

Files: `index.html`, existing stylesheet, `src/main.ts`, `src/ui/practice.ts`, `README.md`.

- Use a switch backed by a native checkbox with `role="switch"`, outside the difficulty radio group, with distinct on/off styling, a keyboard-accessible label and visible focus.
- Label: “Land at both runway ends.” Helper: “Allow aircraft to land at either end of each runway.”
- Keep the control compact at small widths; do not add a separate settings screen.
- Update onboarding and help to describe the selected mode without bringing back heading requirements.
- Have practice reflect the saved choice: show and accept only the original circle when off, or both when on. Reset practice when its mode changes so a stale route cannot target a disabled end.
- In the live game, show only enabled landing markers while drawing. A reverse end in single-end mode must not snap, highlight as a destination, reserve a runway by that absent target, or accept a landing.

## 5. Keep existing scoring and progression

Recommended scope for this release: retain shared personal bests per map, difficulty and starting orientation, plus shared career progress and achievements. The setting changes available landing targets, not the points awarded.

- Preserve all existing records; old saves do not identify which runway setting produced them, so do not invent or migrate historical mode attribution.
- Clarify in help that personal bests are shared across the two runway settings.
- Mode-specific records would be a separate product change, not an implicit addition to this feature.

## 6. Verify the full experience

- Run the full unit suite and production build.
- Update bidirectional tests to explicitly enable two-end mode now that preparation defaults off; add parallel default/single-end coverage.
- Keep regression coverage for sideways and aligned landings at every enabled end, selected-end identity, one score per landing, shared occupancy and helipads.
- Extend browser verification to select the checkbox through the UI rather than relying on an always-enabled map. Verify default-off, enable + reload, disable + reload, and mode persistence through new shifts.
- Use pointer-drawn routes to verify original-end landings in both modes and reverse-end landings only when enabled. In single-end tests, confirm the reverse target is absent and a pass through its location does not start landing.
- Repeat the screenshot case on Saltmarsh with normal diagonal/sideways arrivals to the reverse end when enabled.
- Verify practice, keyboard interaction, narrow-screen layout, pause/resume and orientation changes. Update desktop smoke coverage for the persisted preference if applicable.
- Record commands, results and any actual limitations in this document; mark implemented only after all required work passes.

## Suggested commit sequence

1. Persist the setting and gate map targets, with storage/map tests.
2. Connect setup UI, shift lifecycle and practice; update help and documentation.
3. Add browser coverage and record final verification.

## Completion criteria

A fresh or migrated save starts with one landing end. Explicitly enabling the option gives both ends on every map and survives reload. Neither mode requires alignment. Disabled targets cannot land aircraft. An active shift never changes mode during resize or resume. Existing saves and records remain intact, and unit/build/browser checks pass.
