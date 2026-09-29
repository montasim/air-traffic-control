# Implementation plan: end-to-end QA findings

Status: implemented; browser verification completed for the affected layouts and interactions.  
Basis: `docs/end-to-end-qa-report.md`, findings QA-01 through QA-04.

## Scope

Improve first-run guidance, result actions, short-landscape Home, and career-progress wording while keeping the existing teal/cream/amber game theme, typography, and Hugeicons. Preserve all nine maps, traffic and collision rules, difficulty settings, sounds, achievement rules, save format, and promotion thresholds.

Implement in the order below. No dependencies or save migrations are required.

## 1. Keep first-run guidance clear of Pause — QA-01

Files: `index.html`, `src/styles.css`, `src/main.ts`, and the existing Hugeicons mapping if a close icon is needed.

- Replace the long opening legend with “Drag an aircraft to its matching runway or helipad.” Keep the detailed color/letter explanation in Help.
- At narrow widths, anchor the hint to the lower left and reserve the entire pause-button width, safe-area inset, and a minimum 12px gap. Use shared CSS dimensions for the pause footprint rather than independent magic offsets.
- Add an accessible Close hint button with the existing Hugeicons style and a minimum 44px target. Keep the hint surface pointer-transparent; enable pointer input only on the dismissal control so it does not capture flight drawing elsewhere.
- Auto-hide the opening hint after 6 seconds of active play. Contextual selection/acquisition feedback can still appear until a route is successfully set.
- Explicit dismissal suppresses coaching for the current tab session. Keep this separate from successful-route completion; dismissing instruction must not simulate a gameplay achievement or affect career data.
- Preserve the existing route-set feedback and its short timeout. Clear pending timers on pause, results, and utility navigation so stale hints cannot reappear over another screen.

Acceptance:

- At 320×568 and 390×844, hint and Pause rectangles do not intersect and maintain the specified gap.
- Close hint works with pointer and keyboard; its accessible name is meaningful.
- The initial hint disappears, and dismissed guidance stays dismissed through retries in the same session.
- Drawing, pause/resume, sounds, scores, and achievements behave as before.
- Check Island Rescue specifically: the smaller, temporary hint must reduce obstruction of the lower rescue area.

## 2. Keep result actions visible — QA-02

Files: `index.html`, `src/styles.css`; verify the existing result focus handling in `src/main.ts`.

- Separate the result content into a scrollable body and a non-scrolling action footer inside the same dialog.
- Use a bounded flex or grid layout with `min-height: 0` on the scrollable body. The footer must consume real layout space, rather than cover content with absolute positioning.
- Keep Play again and Main menu side by side when width permits, stacked on narrow portrait screens, and at least 44px tall.
- Reduce decorative spacing on short landscape screens while preserving readable text. Respect viewport safe areas.
- Keep existing button IDs, disabled-during-save behavior, click handlers, and focus trapping. Initial focus must land on a fully visible Play again button when enabled.
- Scope these changes to the result panel; do not accidentally alter pause or confirmation dialogs through shared `.compact-panel` rules.

Acceptance:

- Both actions are fully visible at 844×390 and 667×375 without scrolling.
- Body content remains reachable for collision, sector exit, personal best, promotion, multiple achievements, and save-failure messages.
- At 320×568, actions do not cover result content or escape the dialog.
- Pointer, Tab/Shift+Tab, retry, and Main menu work; replay cannot duplicate the previous shift award.

## 3. Compact Home in short landscape — QA-03

Files: `src/styles.css`; change `index.html` only if necessary for semantic grouping.

- Consolidate the final Home rules before adding another breakpoint. A later unconditional 160px preview height currently overrides the earlier 100px short-screen rule; remove that contradictory cascade.
- For landscape viewports at least 600px wide and at most 500px high, use a centered two-column composition: compact title and secondary navigation on the left, selected-airfield controls on the right.
- Hide the decorative map preview at that breakpoint. The selected map name and Change airfield action remain visible, and the picker retains map previews.
- Keep the airfield name, record, difficulty controls, and Play together. Preserve the centered single-column layout for normal portrait and desktop views.
- Maintain meaningful DOM order, clear focus indicators, and at least 44px action targets. Keep a scrolling fallback for extreme sizes or enlarged text.

Acceptance:

- At 844×390 and 667×375, the selected map, all difficulty choices, Play, and secondary navigation are visible without scrolling at default text size.
- Long names such as Metro International fit without clipping or horizontal overflow.
- At 320×568, 390×844, 768×1024, and 1280×720, the existing visual hierarchy is preserved and every control remains reachable.
- Changing maps or difficulty and returning from Help/Career/Settings retains the selected values.

## 4. Show actual qualifying-map progress — QA-04

Files: `src/main.ts`, `src/ui/career.ts`; reuse `promotionProgress` from `src/progression/ranks.ts`.

- Build the result summary from the same progress calculation used by rank evaluation, rather than presenting only the map requirement.
- Example: `1/8 safe landings · 1/2 shifts · 0/1 airfields with a best of 3+`.
- Use aggregate best scores across difficulties and orientations, matching the established promotion rules. Count each map once.
- Reuse that calculation for the corresponding Career objective if needed to eliminate duplicated counting logic.
- Keep the existing promotion announcement and highest-clearance message. Do not change unlock requirements or save data.

Acceptance:

- A score-1 first shift shows 0/1 qualifying airfields in both results and Career.
- A qualifying score shows the correct distinct-airfield count; multiple qualifying scores on the same map count once.
- Easy, Medium, Hard, portrait, and landscape records contribute under the existing rules.
- Promotion and Chief Controller states display the appropriate messages without invalid denominators.

## Verification and completion

1. Use isolated review fixtures for presentation extremes and a separate production origin for real save checks.
2. Browser-check the viewport matrix above, measuring hint/Pause overlap and result-action visibility. Test keyboard focus as well as pointer activation.
3. Repeat the real journey: choose map/difficulty → play → pause/Help → resume → result → retry/Home → Career → reload. Confirm sound settings, records, and achievements remain intact.
4. Test rotation cancellation, restoration of the original size, and confirmed restart. Check all nine map names in Home; inspect lower-playfield guidance on Island Rescue.
5. Run `npm test` and `npm run build`. Add focused regression coverage only for changed progression behavior or hint lifecycle logic where useful; do not add tests that merely mirror CSS declarations.
6. Update the QA report with measured results and mark each finding resolved only after its acceptance criteria pass. Keep physical-device touch, Safari, audible audio, and long-session balance explicitly pending until tested on suitable devices.

Suggested commit groups after implementation:

1. `fix: prevent mobile guidance and result-action overlap`
2. `fix: compact the home menu for short landscape screens`
3. `fix: show qualifying-airfield progress consistently`
4. `docs: record QA fix verification`


## Implementation verification — 2026-09-29

- QA-01: 320×568 hint ends at x=240; Pause begins at x=252, leaving the required 12px gap. Hugeicons close glyph mounted; pointer and Enter dismissal worked. Retry retained dismissal. A fresh Island Rescue session auto-hid the opening hint after the configured interval.
- QA-02: at 844×390, result actions occupy y=314–362 inside the panel ending at y=374. Both actions also fit at 667×375 and stack visibly at 320×568. Shift details are keyboard focusable and scroll independently; Shift+Tab from Play again reaches them.
- QA-03: at 667×375, Play occupies approximately y=263–313. All difficulty choices and secondary navigation are visible. Metro International fits. Home has no horizontal overflow at 320×568, 390×844, 768×1024, or 1280×720.
- QA-04: the result summary displayed `1/1 airfields with a best of 3+`; Chief Controller retained `Highest clearance earned.` Results and Career now share the existing tested `promotionProgress` calculation, including distinct-map and orientation handling.
- `npm test`: 304 passed across 29 files. `npm run build`: passed. `git diff --check`: passed. No errors or warnings in the inspected browser logs.
- No gameplay, audio, save schema, difficulty, or achievement-rule changes. Existing physical-device and extended-play validation limits remain. Production persistence was verified in the preceding QA pass, not repeated for these presentation changes; save-failure and every possible multi-award message were not individually browser-injected in this follow-up.
