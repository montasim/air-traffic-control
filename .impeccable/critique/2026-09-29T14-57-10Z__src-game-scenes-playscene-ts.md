---
timestamp: 2026-09-29T14-57-10Z
slug: src-game-scenes-playscene-ts
---
# Mobile UI/UX and QA review

Method: dual-agent (A: /root/mobile_ux_review; B: /root/mobile_qa_review), independently assessed before synthesis. Reviewed local build at http://localhost:4180/ on 2026-09-29. No application code changes.

## Scope and limits

Responsive browser viewports: 390×844, 360×640, 844×390; QA additionally checked 320×568 and height-only 390×780. Representative screens: home, airfields, help, practice, Saltmarsh gameplay, pause, and confirmation.

These are desktop-browser viewport simulations, not physical iOS/Android tests. Actual touch accuracy, Safari, safe areas, mobile toolbar behavior, sustained performance, and all nine airfields remain unverified. Background animation was unreliable, so moving-aircraft proportions were assessed from source geometry; the gameplay screenshot is not conclusive visual proof. A practice drag set a route, but a completed landing was not verified.

## UI/UX findings

1. P1: Competing aircraft and world scaling rules. Aircraft target 76/68/70 CSS px while map geometry shrinks. At a 390px-wide portrait field, Saltmarsh runway widths calculate to about23px/18px excluding outlines. Aircraft dominate the miniature airfield. Evaluate smaller mobile sprites while preserving generous touch targets and visible collision coherence.
2. P2: Help requires substantial scrolling before the interactive practice CTA. At390×844 only the first full instruction card and part of the second fit. Consider placing practice near the introduction.
3. P2: At844×390 landscape, the home hides the selected-field thumbnail. Controls fit, but players lose the spatial preview. Consider a compact preview if it does not crowd primary actions.

Strengths: cohesive cream/green/amber identity, clear Play action, readable menus, difficulty controls, focused practice, explicit abandonment confirmation, and aircraft color reinforced by letters/silhouettes. No horizontal clipping observed in checked screens.

### Heuristics (review judgments, not automated pass rates)

| Heuristic | Score /4 |
|---|---:|
| System status |3|
| Real-world match |2|
| User control |3|
| Consistency |3|
| Error prevention |3|
| Recognition |3|
| Efficiency |2|
| Visual minimalism |3|
| Recovery |2|
| Help |3|
| Total |27/40|

## QA findings

1. P1, browser reproduced: Start at390×844, Play, resize only height to780. Game pauses; primary action becomes Restart. Confirmation says unfinished shift will be discarded and incorrectly says Rotate back. Restoring390×844 restores Resume. Root cause: exact dimension comparison in src/main.ts:168. Actual address-bar changes on a physical device were not tested.
2. P2, source confirmed: Aircraft visuals extend beyond selection hit areas. At390px portrait, commuter nose reaches34px from center but touch hit radius is31.2px. At320px the respective values are32px and25.6px. Source: src/game/scenes/PlayScene.ts:251. Physical touch miss reproduction remains pending.
3. P2, source confirmed design constraint: Aircraft enlargement is also passed into collision geometry, affecting effective crowding/difficulty. A scale revision needs collision/landing/balancing checks, not only a sprite change. Tests currently enforce the fixed large footprint rather than relative proportions.

Passed:27 focused tests for viewport, visual tokens, collisions and landing targeting. Practice pointer drag produced Route set. Small-screen practice actions wrapped and remained accessible by vertical scroll.

## Recommended decision order

First agree mobile aircraft/world proportions and independent touch target sizes. Then handle same-orientation resizes without discarding progress and align selection geometry with visible sprites. Finally improve practice discovery and landscape preview. This is a proposed direction, not an implemented change.

## Evidence and run notes

- Source target/slug: src/game/scenes/PlayScene.ts / src-game-scenes-playscene-ts.
- Ignore list: no .impeccable/critique/ignore.md found.
- Independent UX/QA agents; detector findings withheld until UX assessment finished.
- Screenshots: /tmp/air-control-mobile-ux/390-home.png,390-help.png,390-practice.png,360-home.png,844-home.png,844-airfields.png. 390-gameplay.png shows a paused field with clipped aircraft; do not use as proportional proof.
- Detector ran once against index.html and src.147 flags:68 color,68 font-size,9 radius,1 broken-image(index.html:142),1 marquee(index.html:0). Missing parser dependencies forced regex mode; no computed contrast audit. Dynamic preview image is a false positive, boot loading indicator is not a gameplay marquee defect. Stale Vector Approach/four-map design documents make token flags unsuitable as confirmed mobile defects.
- Browser overlays skipped: tool evaluation is read-only; no script injection performed. Browser visibility requested from root; subagent visibility unsupported. Background RAF and root CDP timeouts limited live evidence and were not counted as app bugs.
- Review tabs closed and viewport overrides reset. Existing preview server retained; no review-only server started. Screenshots and detector JSON retained in /tmp as evidence.
- Questions deferred to the user's decision after reviewing findings. No fixes or deployment performed.
