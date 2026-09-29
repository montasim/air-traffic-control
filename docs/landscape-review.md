# Landscape UI/UX and QA review

Date: 2026-09-29. Tested the local mobile implementation at http://localhost:4180/ without application code changes.

## Method

Root performed browser QA at844×390,667×375,568×320 and height-only844×340. An independent UX reviewer inspected root screenshots and CSS because its separate browser session was unavailable. These are desktop-browser viewport simulations, not physical-phone tests. Scope: Saltmarsh gameplay, home, help, practice, pause, height resize, rotation and return.

## UI/UX findings

- **P2: Practice opens with its aircraft below the viewport at667×375.** The field begins at y222; the aircraft occupies approximately y425–486. The instruction is visible but the object to drag is not. Scrolling225px reveals both aircraft and runway. Shorten the landscape header stack or bring the interaction field into view on entry.
- **P2: Compact landscape home requires scrolling to Play at568×320.** Play occupies y410–460. The two-column landscape rule starts at600px width, so this size falls back to a tall stacked layout. Consider a compact landscape layout below600px without shrinking touch controls. Play remains reachable and functional by scrolling.
- At667×375 the two-column home fits:50px Play button ends at y349. The preview is visible, Settings wraps acceptably, and no horizontal overflow was observed.
- At844×390, live aircraft are recognizable and proportionate to the illustrated field. The screenshot review found ample open routing space. Pause is50×50px and fully inside the viewport.

## QA results

| Check | Result |
|---|---|
| Practice mouse drag at667×375 after scrolling | Pass: Route set feedback |
| Height-only844×390→844×340 while paused | Pass: world remains1947×900, Resume works without restart confirmation |
| Landscape568×320→portrait320×568 | Pass: protective pause and Start in portrait action |
| Return to568×320 | Pass: Resume returns and continues gameplay |
| Home horizontal overflow at667×375 and568×320 | None observed |
| Compact-home Play | Reachable by scrolling; UX issue above |

A moving-aircraft drag in live gameplay did not produce confirmed route feedback; the aircraft had moved between capture and input. It is inconclusive, not recorded as an app failure or a successful live-route test. The deterministic practice drag provides confirmed pointer-routing evidence. A completed landing was not verified in this pass.

## Remaining coverage

Physical touch, finger occlusion, real mobile browser toolbar behavior, Safari, safe areas, sustained performance, and exhaustive horizontal playthroughs across all maps remain untested. No new automated suite was run because this pass changed no app code; prior implementation tests remain documented separately.

Evidence retained at /tmp/air-control-landscape/:844-gameplay.png,667-home.png,667-practice-top.png,667-practice-scrolled.png,568-home.png. Temporary test tab closed and viewport override reset after testing.

Recommendation: address landscape practice framing and the sub600px landscape home breakpoint. Current findings do not justify another aircraft-scale change.
