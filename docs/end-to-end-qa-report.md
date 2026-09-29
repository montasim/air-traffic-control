# End-to-end QA report

Date: 2026-09-29  
Revision tested: `73b3192`  
Original QA result: tested core journeys passed; four usability findings were recorded. No crash or saved-progress loss was reproduced. This is not a claim of exhaustive device compatibility or long-session gameplay certification.

## Environments and isolation

- Development build at `localhost:5173`, with memory-only trainee, promotion, and all-unlocked fixtures.
- Production build at `127.0.0.1:4287`, using a separate origin and real IndexedDB persistence. No development fixture controls appear in production.
- Chromium desktop 1280×720; responsive checks at 390×844, 320×568, and 844×390. Actual viewport dimensions were checked when testing responsive behavior.
- Existing user career data was not modified. No application code was changed.

## Confirmed findings

### QA-01 — Medium: first-run hint overlaps the pause control on narrow phones

Reproduce: start a game in a fresh session at 320×568 before completing the route coach.

The instruction bubble occupies x=55–265, y=442–546, while Pause occupies x=252–302, y=500–550. They overlap by 13×46 CSS pixels. The bubble also obstructs the lower playfield. It has no dismiss control and the initial message has no timeout; it is hidden by pausing or completing the relevant coach flow. Pointer events pass through the bubble, so this is a visual obstruction, not a confirmed blocked click.

Expected: first-run guidance leaves the pause control and active airspace visually clear. Shorten the mobile copy and provide dismissal or place instruction before traffic begins.

Source: `src/styles.css` `.route-coachmark`; `src/main.ts` `beginRun` and route-coach handling. Reconfirms the earlier mobile QA finding.

### QA-02 — Medium: result actions are clipped on short landscape screens

Reproduce: at 844×390, complete a shift with an achievement, or use the trainee collision-result fixture.

The result panel spans y=16–374. Play again and Main menu span y≈355.5–405.5, leaving only their top portions initially visible. The panel is scrollable and both actions work after scrolling. The initially focused Play again button is also mostly clipped.

Expected: keep the primary result actions visible, using a compact layout or a persistent action row. Reconfirms the earlier mobile QA finding. The collision case here verifies result presentation, not live collision geometry.

### QA-03 — Low: landscape Home puts the primary Play action below the fold

Reproduce: open Home at 844×390 and scroll to the top.

The panel is 390px tall with 669px of content. Play starts at y=521 and ends at y=571. The map preview consumes 160px near the top; players must scroll before they can start. All actions are reachable, but this adds friction on phones held horizontally.

Expected: use a compact preview or a landscape arrangement that shows the selected airfield, difficulty, and Play without scrolling.

### QA-04 — Low: result summary does not show progress toward the qualifying-map objective

Reproduce: finish a first shift with one landing. In production, results showed `1/8 safe landings · 1/2 shifts · best 3+ on 1 map`. Career correctly showed `Airfields with a best of 3+ 0 / 1`.

The first two clauses report current progress, while the last reports only a requirement. It can read as though one map already qualifies. This is a copy inconsistency; the underlying career calculation was correct.

Expected: show `0/1 airfields with a best of 3+`, or clearly prefix the requirement with “Next objective”. Source: `src/main.ts` `rankProgressCopy`.

## Browser coverage and results

| Journey | Result and evidence |
| --- | --- |
| Startup and reload | Development and production reached Home; direct Career refresh returned to Career with an in-app Back destination. |
| Home and difficulty | Easy, Medium, and Hard selection reflected in Home and HUD; selection survived production reload. |
| Map categories | All seven filter buttons checked: Regional returned four maps, each specialist category returned its single map, All returned nine. |
| All nine maps | Selected each through the picker; launched, visually inspected desktop rendering, paused, confirmed leaving, and returned to the picker. No console errors in the inspected logs. |
| Locks and promotion | Trainee locks were shown. A real three-landing shift from the promotion fixture advanced to Control Assistant and unlocked Desert Parallel and Executive Point. |
| Live gameplay | Pointer routes were accepted, including explicit `Route added to helipad`. A Saltmarsh shift ended naturally at score 3 and awarded Mixed Fleet and Getting Comfortable from the seeded career. |
| Real production shift | River Bend Easy ended naturally with score 1 and First Landing. Refresh retained 1 landing, 1 completed shift, Easy landscape best 1, and the earned achievement. |
| Other save preferences | River Bend selection, Hard difficulty, sound off, and 10% volume survived a production reload. |
| Pause and menus | Pause/resume, outside-click dismissal, restart confirmation, Escape cancellation and focus restoration, and confirmed departure worked. |
| Help and practice | Help opened from a paused game; practice rejected an unfinished route and accepted a valid route. Back returned through Help to the paused game. Completed demonstration feedback was verified in the earlier mobile pass. |
| Abandonment | After practice and leaving the unfinished production shift, career remained at 1 landing, 1 shift, and 1 achievement. |
| Rotation | 390×844 to 844×390 displayed the layout-change notice and restart confirmation. Canceling and restoring 390×844 allowed Resume. Confirming started the new layout. |
| Results | Natural sector-exit results and fixture collision results displayed scores and progress. Retry and Main menu worked, including scrolling in short landscape. |
| Offline cache | After stopping the production preview server, reload completed from the installed service-worker cache, retained Career, and launched a new game. This tests a previously cached app with the server unavailable, not first-visit offline or OS installation. |

Maps checked: Saltmarsh Gateway, River Bend, Desert Parallel, Twin Banks, Falcon Air Base, Executive Point, Metro International, Freight Junction, Island Rescue.

## Automated verification

- `npm test`: **304 tests passed across 29 files**.
- `npm run build`: TypeScript and production bundle passed; service-worker assets generated.
- Existing tests cover collision geometry, heading continuity, landing targeting, traffic pacing/difficulty, map geometry, storage migration, achievement rules, rank rules, and audio logic.

## Coverage limits

- Native touch, multi-touch, physical iOS Safari/Android, browser-chrome resizing, notches, audible playback quality, and OS-level installation were not verified.
- Long-session difficulty balance, battery use, and sustained frame rate need device playtesting.
- Live collision accuracy was not exhaustively exercised in the browser. Collision tests passed; the collision result UI also passed its fixture check.
- Not every achievement was earned manually. Browser coverage includes First Landing, Getting Comfortable, and Mixed Fleet; remaining award rules rely on automated coverage.
- Corrupt/legacy save and write-failure scenarios were covered by existing tests, not browser fault injection.
- Slow-network first load, failed asset recovery, and service-worker upgrades during an active shift were not exercised.

Recommended next step: address QA-01 and QA-02 first, then run a physical-phone touch and audio pass before release.


## Fix verification follow-up — 2026-09-29

QA-01 through QA-04 have been addressed. The implementation and measured follow-up checks are recorded in `docs/qa-fixes-implementation-plan.md`. The hint now reserves a 12px Pause gap and can be dismissed; result actions occupy a fixed footer; short landscape Home shows Play without scrolling; results and Career share qualifying-airfield counting. Tests (304) and production build pass. The original findings above are retained as reproduction history; device-validation limits remain applicable.
