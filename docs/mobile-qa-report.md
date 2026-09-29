# Mobile browser QA — 2026-09-29

## Scope and environment

Tested localhost in Chromium using 390×844 and 320×568 portrait viewports and 844×390 landscape. These are responsive viewport tests, not physical iOS/Android or native touch tests. Used isolated `review=trainee` and `review=all` saves; the user's saved career was not changed. The bottom development review buttons seen during testing are fixture controls, not production UI.

## Verified in the browser

- Home: selected map, all three difficulty choices, Play, Change airfield, Help, Career, and Settings. At 320×568 the page scrolls and all actions remain reachable.
- Airfield selection: category filtering, locked-map explanation, unlocked selection, and return to the selected map on Home.
- All nine maps: launched and visually inspected in portrait. Runways and helipads render within the mobile game area.
- Gameplay: aircraft movement, pointer route interaction, pause/resume, restart confirmation cancellation, and confirmed departure to the main menu. A successful live-game landing was not established in this pass.
- Rotation: portrait-to-landscape pauses the shift, explains the layout change, requests confirmation, and starts the new layout with the same difficulty.
- Results: collision and sector-exit result screens, retry, main menu, best score, and achievement feedback. These result cases used development fixtures, not naturally induced collisions.
- Career: updated totals, First Landing award, objectives, map records, achievement cards, scrolling, and difficulty-specific records. Switching from Easy to Hard removed the Easy record from the displayed results.
- Settings: sound toggle, volume endpoints (0 and 100), matching status copy, and retained values after leaving and reopening. Settings opened during a game return to the paused shift; Resume works.
- Help/practice: direct Help link, refresh, Back, invalid route feedback, accepted pointer route, reset, demonstration, and safe-landing completion feedback.
- Help and Career had no horizontal content overflow at 320px. Settings controls and page footer remained reachable by scrolling.
- No warnings or errors appeared in the inspected browser console logs.

## Findings

### Opening gameplay hint is too large on narrow phones

At 320×568, the initial instruction bubble occupies much of the lower playfield and partially overlaps the pause area. On Island Rescue it also obscures part of the lower rescue-pad area. Pause remained operable during the check, but the visual obstruction is undesirable during live traffic.

Recommended follow-up: shorten the mobile hint, reserve space around the pause button, and make the instruction dismissible or move first-run instruction before traffic starts.

### Short landscape results require scrolling

At 844×390, achievement-rich results put Play again and Main menu below the initial visible portion of the result panel. Scrolling and activation work. A compact result layout or persistent action row would improve discoverability.

## Automated verification

- `npm test`: 304 tests passed across 29 files.
- `npm run build`: TypeScript and production build passed.

## Remaining device validation

Native finger dragging, multi-touch, iOS Safari, Android browser chrome/safe areas, audible playback/autoplay behavior, install/offline PWA behavior, slow-network loading, and sustained frame-rate/battery behavior need device-specific testing. Review fixtures are memory-only, so cross-reload save persistence was not browser-tested here; storage coverage comes from the automated suite. This pass does not certify collision accuracy or difficulty balance through extended play.

No application code was changed during this QA pass.
