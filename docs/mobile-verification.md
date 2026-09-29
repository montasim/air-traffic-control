# Mobile implementation verification

Date: 2026-09-29. Local implementation; not published.

## Changes

- Aircraft target 48/44/44 CSS pixels on phone-sized playfields, transitioning continuously from a 430px short side to the previous desktop targets at 700px. World-space sprite and solid-airframe collision scales remain aligned and fixed for each shift.
- Selection covers the complete solid silhouette plus 8 CSS pixels for touch or 3 for mouse. Touch target diameter is at least 44px. Padding never affects collisions.
- The world initially expands to the viewport aspect ratio, then Phaser FIT preserves that world during resizing. Same-orientation changes cancel an unfinished stroke while retaining its prior route and the active simulation. Rotation still pauses for an explicit new-layout decision. New shifts rebuild for the current dimensions.
- Practice entry appears before help illustrations. A 70px field preview is restored in short landscape home layouts.

## Completed checks

- All 322 unit tests pass, including visible-edge selection at 320/360/390/430/900px, selection after a display resize, orientation policy, initial world aspect, and smooth aircraft scale transition.
- Web and desktop production builds pass.
- Extended Electron smoke passes: startup, textures/fonts, renderer isolation, gameplay, resize/resume with unchanged world dimensions and score, and saved difficulty after restarting the application.
- Browser at 390px portrait: actual smaller aircraft and a drawn route visible; successful landing feedback observed. A height change to780px retained the900×1947 canvas world while fitting it into a360px-wide displayed canvas. The pause action offered Resume instead of a forced restart.
- Help at390×844: practice CTA occupies y350–400, visible without scrolling; no horizontal page overflow.
- Home at844×390: preview visible; Play remains50px tall and fully visible (bottom353px); no horizontal page overflow.
- Independent follow-up source review found no concrete QA regressions. Independent UX source/screenshot review judged aircraft proportions improved and found no additional material concerns; landscape control fit was subsequently verified in the browser.

The resize smoke initially caught a delayed-pause race after Resume. Same-orientation resizing now cancels only partial drawing instead of scheduling a pause; the smoke passed after this correction.

## Limits and remaining acceptance work

- Physical iPhone Safari and Android Chrome touch accuracy, finger occlusion, toolbar behavior, safe areas, and sustained device performance still require real-device testing.
- The viewport tests and existing map/landing/collision suite cover geometry, but an exhaustive manual playthrough of all nine maps and all three aircraft types on real phones has not been completed.
- A seeded browser scenario with a nonzero score and in-progress route was not added. Electron regression checks stable world dimensions and score; browser observation supplied live route/landing evidence. More deterministic route-resize coverage remains useful before broad release.
- The static design detector ran once in degraded regex mode because parser dependencies were unavailable. It is not a computed-contrast or accessibility certification. Existing stale design-token documentation and dynamic-image false positives remain separate from this change.
- Browser automation had intermittent timeouts. Those were not counted as application performance defects.

No traffic-rate, aircraft-speed, save-schema, or publishing changes were made. Smaller bodies can change effective crowding; real-device playtesting should inform any separate balancing change.
