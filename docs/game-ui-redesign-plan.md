# Vector Approach — game presentation redesign

Date: 2026-09-29

Status: implemented on 2026-09-29. The original audit below records the pre-redesign game; see the implementation report for delivered changes, adaptations, and verification boundaries.

## 1. Brief and recommendation

Redesign the entire presentation: title screen, airfield selection, career, settings, HUD, onboarding, aircraft, terrain, airports, routes, warnings, pause, results, and responsive transitions. The user explicitly confirmed that airfields and aircraft are included.

The audience is a casual player using mouse, touch, or pen for short routing sessions. The core experience is selecting an aircraft, drawing a readable approach, landing it, and managing increasingly busy airspace. The airfield must lead the screen; controls support play.

Recommended direction: **an illustrated aviation arcade game**. Use cohesive, colorful miniature airfields, recognizable aircraft, tactile game controls, restrained navigation chrome, and satisfying operational feedback. Follow the readability and directness of the supplied Air Control references while keeping Vector Approach's original maps, identity, and mechanics. This is a complete presentation replacement, not another dark-panel polish pass.

Keep the product name, civil-airport theme, three aircraft categories, four maps, local progression, and offline operation. Retain the bundled Barlow Condensed and Atkinson Hyperlegible fonts initially; their hierarchy and application need more work than replacing the files. Preserve cyan/amber/coral as aircraft identity signals. Supersede the incumbent muted terrain and graphite-modal composition where they conflict with this brief.

## 2. Browser exploration and evidence

Explored `http://localhost:5173/` with the browser at the existing desktop size (1370×926), 390×844 portrait, and 844×390 short landscape. A separate fresh local tab verified persisted selection/settings. Responsive dimensions are desktop browser emulation, not physical-device touch verification.

| Feature/state | Browser evidence | Review implication |
| --- | --- | --- |
| Launch and title | Title, instructions, career summary, four map choices, sound, volume, Play | Too much setup text before the game; scenery almost completely obscured |
| Map selection | Switched Saltmarsh Gateway to River Bend; background and Play label changed | Selection works, but solid-color preview strips convey little about the actual map |
| Locked maps | Desert Parallel and Twin Banks shown as disabled with rank names | Cannot inspect a locked destination or understand its complete unlock requirements from the card |
| Saltmarsh play | Viewed terrain, connected runways, helipad, and moving aircraft | Flat, dark scenery; runway destinations are visually difficult to distinguish |
| River Bend play | Viewed desktop, portrait, and short-landscape layouts | Detailed painted terrain clashes with flat airport structures and outlined aircraft |
| Route rejection | Commuter routed to the other runway: “Route not added: use the matching landing zone” | Rejection exists, but explanatory status is screen-reader-only; visible feedback needs explicit meaning |
| Valid routes | Assigned commuter to its runway and helicopter to helipad; route status confirmed both | Retain route snapping and contextual destination feedback |
| Landing | Portrait commuter landing produced “Aircraft landed. Score 1.” and HUD 01 | Core loop works; add a more legible, restrained reward moment |
| Coachmark | Selection instruction and “Route set” appeared after interaction | Teaching begins after the player has already discovered how to select an aircraft |
| Pause/resume | Button and Escape tested; paused map preserved behind overlay | No map-selection/home exit; settings get first focus instead of Resume |
| Restart | Restart from pause returned score to 00 | Distinguish restart from resume; make abandonment consequences clear |
| Audio | Mute on/off and volume 0 tested; restored sound on and volume 80 | Settings synchronize and persist; move their full controls off the main launch composition |
| Airspace failure | Reached “Aircraft left the sector”; score/best and career shift count shown | Failure panel hides most spatial context; identify the aircraft and exit position |
| Results navigation | Choose map returned to selection | Preserve a fast retry/map-choice loop |
| Persistence | Fresh tab retained River Bend, sound on, volume 80, and completed shift count | Preserve save schema and map IDs |
| Portrait selection | Selected River Bend was partly outside the initial carousel viewport | Scroll selected item into view; provide explicit paging/navigation |
| Orientation change | Resume changed to “Start in landscape”; activating it restarted at 00 | Existing run is abandoned; explain this before activation |
| Short landscape | Compact menu uses internal scrolling; active map fits with corner HUD | Design this layout directly, not as a compressed portrait dialog |
| Console | No captured warning/error entries in the inspected responsive tab | This is not a performance or production/offline certification |

**Coverage boundary:** Desert Parallel and Twin Banks gameplay, promotion celebrations, final-rank state, and collision-specific results were not reached through the normal browser session. Their definitions and code paths were inspected, and they are mandatory implementation verification cases. Do not describe them as browser-tested. A helicopter route was assigned, but its completed landing was not observed. Physical touch/pen, installed-PWA offline operation, browser background auto-pause, and reduced-motion behavior also require later verification.

Review play changes ordinary local session/progression state. Audio was restored to its original on/80 setting; saves were not manually unlocked or rewritten.

## 3. Reference takeaways

Sources inspected:

- [Air Control 2](https://play.google.com/store/apps/details?id=com.fourpixels.aircontrol2): screenshot gallery and embedded trailer. Reviewed illustrated terrain, compact corner controls, visible routes, aircraft silhouettes, and prominent separation warnings.
- [Air Control 2 — Premium](https://play.google.com/store/apps/details?id=com.fourpixels.aircontrol2full): listing and gameplay screenshot. Its first inspected image uses the same illustrated field language as the free listing.
- [Air Control](https://play.google.com/store/apps/details?id=dk.logisoft.aircontrolfull): listing and carrier-map screenshot, with the playfield occupying the composition and a small HUD.
- [Air Control 2 trailer](https://www.youtube.com/watch?v=1AsPgGm3kPk): launched from the supplied listing and sampled during playback; not a frame-by-frame analysis.

Take the principles: a recognizable game world, quick destination reading, consistent art scale, uncluttered routes, and visible cause/effect. Do not copy their terrain, airport layouts, sprites, logo, promotional lettering, or screenshots into shipping assets.

The listings describe features beyond this game's current scope, including special aircraft, cooperative maps, and additional modes. Those are reference context, not redesign requirements. Do not add speed multipliers, storms, multiplayer, purchases, or leaderboards as part of this UI work.

## 4. Prioritized problems

| Priority | Problem | Concrete change |
| --- | --- | --- |
| P0 | No consistent art system across terrain, airport, and aircraft | Establish one lighting direction, edge treatment, texture density, and scale hierarchy across all four maps |
| P0 | Landing compatibility requires discovery by selection/trial | Add discreet permanent category insignia at runway thresholds and helipad; stronger matching emphasis while drawing |
| P0 | Rotation/restart can discard a scoring run with insufficient explanation | Dedicated interruption copy and explicit restart action; allow return to previous orientation without restarting |
| P1 | Opening composition resembles a configuration dialog | Make the selected airfield visible and central; give Play clear dominance; move detailed settings to a utility screen |
| P1 | Map choices do not preview their actual spatial challenges | Real generated-from-game thumbnails, selected-map detail, visible record and unlock information |
| P1 | Pause lacks a return path | Resume, Restart, Choose airfield, and Settings, with clear abandon-run semantics |
| P1 | Aircraft identity relies on small color accents | More visible livery areas plus distinct silhouettes and redundant category symbols |
| P1 | Failure lacks spatial explanation | Freeze and identify the involved aircraft/exit point before showing results |
| P1 | Career requirements are a compressed sentence | Separate prerequisite counters and qualifying-map progress; do not invent a misleading single XP bar |
| P2 | Coachmark arrives late and can crowd small screens | Initial short routing prompt, compact gesture demonstration, replayable How to play |
| P2 | Mobile selection and short-landscape menu need purposeful layouts | Center selected carousel item, expose paging, split short-landscape composition |

## 5. Screen and interaction specification

### Title and airfield selection

- First view: recognizable Vector Approach title, unobscured airfield artwork, one dominant Play action, and compact Airfields / Career / Settings / How to play navigation.
- Default to the last selected unlocked airfield. Show its name, difficulty, and record close to Play.
- Airfield selection uses actual representative map images, not gradient or color bands. On desktop, a large selected preview with four compact choices; on portrait, a large preview above a pageable selector; on short landscape, preview left and controls right.
- Locked airfields remain inspectable. Their detail shows a lock, required rank, each remaining prerequisite, and a disabled Play action. This changes presentation access, not gameplay access.
- Selected, focused, hovered, pressed, and locked states must remain visually distinct. Do not reduce locked copy to unreadable opacity.
- Keep movement in menus decorative and bounded. A static preview is an acceptable reduced-motion fallback. Menu scenery must not advance the real simulation.

### Gameplay HUD and onboarding

- Put score, record, and pause in a consistent compact arrangement with protected input regions. Map identity can appear briefly at start and persist in pause, rather than occupy active airspace.
- Display record scope as “Portrait best” / “Landscape best” in explanatory surfaces. Selection may show overall map best, explicitly labeled.
- Use short, meaningful score feedback: a brief +1 at the landing area and a small score pulse. No full-screen reward overlay during active traffic.
- Before first interaction, show “Drag an aircraft to its matching runway” with a small aircraft/category key. Dismiss after a confirmed route; keep How to play available from pause.
- Show invalid target feedback near the destination and concise visible copy. Preserve the live-region announcement without announcing every pointer sample.

### Routes, targets, and aircraft

- Category mapping: liner/cyan, commuter/amber, rotor/coral, plus distinctive silhouette or L/C/H signage. Terrain must not compete with these signals.
- Keep neutral runway identity small and permanent; show capture area, direction, and stronger color only for selection/acquisition. Avoid permanent giant target rings.
- Differentiate selected aircraft, route being drawn, assigned route, acquired landing area, landing, and invalid target. Re-routing must remain readable while other assigned routes stay quieter.
- Retain generous invisible selection geometry. Tune visual footprint independently from collision radii; avoid enlarging sprites until they imply collisions where the simulation permits safe passage.
- Use consistent body shading, canopy highlights, outlines, and shadows across the fleet. Increase recognizable livery, particularly for small-screen viewing. Give helicopter body and rotor distinct readable layers.
- Keep route strokes readable over asphalt, water, grass, and sand using a restrained contrast underlay. Preserve actual path/capture geometry; never draw a promise the simulation does not honor.

### Terrain and airports

- Commit to stylized illustrated terrain with restrained texture and a clear value hierarchy: scenery < physical airport < route/aircraft < urgent warning.
- Shared airport kit: asphalt edge, threshold markings, category insignia, taxiways, apron, terminal, hangars, helipad, lighting/shadow treatment. Buildings and shadows must never paint across an operational runway unintentionally.
- Saltmarsh Gateway: readable tidal drainage, green fields, shallow water, a coherent regional airport.
- River Bend: preserve the curved river landmark; harmonize airport material with terrain and reduce noisy field texture where routes cross.
- Desert Parallel: sand/mineral strata, sparse settlement, offset parallel approaches; preserve the established layout and traffic profile.
- Twin Banks: clearly different banks joined by one river corridor; two visibly related airfields with distinct spatial challenges.
- Use shared code-native airport geometry. If illustrated terrain plates are used, they contain scenery only and must match each layout variant. Do not bake runways, landing targets, or aircraft into terrain images.
- Author all assets locally with provenance. Use one terrain strategy consistently across the atlas; avoid another “one painted map, three placeholder maps” delivery.

### Warning, pause, failure, and results

- Escalate existing proximity warnings with clear outlines/brackets and a readable link between the involved aircraft. Preserve current warning/collision thresholds. Do not add a new predictive collision system inside this presentation task.
- Add an edge-risk cue based on existing position/direction where reliable; do not present a countdown unless it reflects actual simulation logic.
- On failure, stop input and preserve the relevant map context. Briefly mark the collision pair or escaped aircraft boundary position, then show results. If the event does not expose that position, extend presentation event payloads instead of guessing.
- Results hierarchy: outcome, score, new-record state when true, career progress/promotion, Play again, Choose airfield. Optional extra statistics require actual captured data; no invented accuracy or performance ratings.
- Pause hierarchy: Resume first and initially focused, then Restart and Choose airfield; Settings and How to play secondary. Returning from nested screens restores pause, not running traffic.
- For restart/map exit during a live run, clearly state that unfinished shift progress is discarded under current rules. A small in-game confirmation is appropriate for accidental abandonment; it is not an agent approval step.
- For orientation change: explain that the layout changed, offer restart in the new orientation, and tell the player they can rotate back to resume. Preserve current save semantics unless a separate gameplay change is agreed.

### Career and settings

- Career shows earned rank, next rank, cumulative landings, completed shifts, and qualifying-map bests as separate requirements.
- Use the existing seven-rank catalog and actual thresholds. Desert unlocks at Control Assistant; Twin Banks at Tower Controller. Later ranks have no extra map unlocks, so do not imply hidden rewards.
- Promotion is a brief result-screen celebration with the new rank and actual unlocked map. Maximum rank has a complete state instead of a nonexistent next rank.
- Settings retain sound on/off and volume, a visible numeric volume, and synchronized state across entry points. Keep sound optional and redundant with visual feedback.

## 6. Implementation sequence and file ownership

### Phase 1 — reproducible states and art target

1. Capture baseline screens and create isolated browser-test fixtures for every map, aircraft category, valid/invalid route, collision, escape, promotion, and max-rank state. Fixtures must not overwrite real player saves or weaken production map locks.
2. Produce one coherent full-screen gameplay concept plus title/map-selection and results compositions, including portrait. Use the reference direction above as the brief; final art details remain proposed until visual review.
3. Define palette, typography hierarchy, texture density, lighting, sprite scale, input exclusion zones, and responsive composition in a design specification.

Exit: the gameplay concept demonstrates aircraft, routes, airport, terrain, HUD, and warning together. Do not approve scenery in isolation from playability.

### Phase 2 — playable vertical slice

Implement Saltmarsh end-to-end: airfield selection → start → draw → land → pause → fail → retry. Use the new terrain/airport kit, aircraft family, and shared UI treatment. Validate desktop and portrait before spreading the system to all maps.

Primary files: `src/game/palette.ts`, `src/game/rendering/shared-map/airfieldPainter.ts`, `src/game/rendering/AirfieldRenderer.ts`, `src/game/rendering/AircraftView.ts`, `src/game/rendering/aircraft/silhouettes.ts`, `src/game/rendering/aircraft/visualTokens.ts`, `src/game/maps/saltmarsh-gateway/`, `src/game/scenes/PlayScene.ts`.

Exit: the actual running game matches the selected concept and route/landing behavior remains unchanged.

### Phase 3 — navigation and supporting screens

Replace the modal-dominated title composition; implement preview-led airfield selection, inspectable locked maps, career details, settings, help, pause exits, explicit interruption copy, and result/promotion layouts.

Primary files: `index.html`, `src/styles.css`, `src/main.ts`, `src/ui/hugeicons.ts`. Extract a small number of screen/render helpers into `src/ui/` only as the new screens make `main.ts` difficult to follow; keep the current stack and avoid a framework migration.

Read existing progression/storage APIs rather than duplicating their rules. Keep map IDs and save schema compatible.

Exit: every visible action has a working return path; nested overlays pause gameplay; first focus and keyboard navigation work.

### Phase 4 — complete atlas and feedback

Apply the approved art system to River Bend, Desert Parallel, and Twin Banks in portrait, landscape, and square layout variants. Generate matching thumbnails from the final presentation. Complete routes, warning escalation, landing feedback, failure focus, and bounded transitions.

Primary files: `src/game/maps/river-bend/`, `src/game/maps/desert-parallel/`, `src/game/maps/twin-banks/`, `src/game/assets/presentationAssets.ts`, `src/game/rendering/RouteGuidanceRenderer.ts`, `src/game/rendering/guidanceGeometry.ts`, `src/game/scenes/PlayScene.ts`, `src/app/feedbackEvents.ts`, `public/assets/`.

Exit: all four maps feel like the same game without losing their geography or changing their playable geometry.

### Phase 5 — verification and handoff

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Add focused interaction tests for new navigation, locked-preview behavior, focus return, orientation messaging, and save compatibility. Reuse existing simulation, targeting, map-contract, audio, and progression tests.
- Browser-review desktop, 390×844, 844×390, tablet, and near-square layouts. Include the user's actual desktop size and a narrow 320px width.
- Exercise all four maps and all result/promotion states with isolated fixtures; repeat at least one ordinary unseeded game loop.
- Verify mouse and real/coarse touch selection, route replacement, release outside canvas, edge spawns, HUD occlusion, and pause during drawing.
- Verify reduced motion/transparency, focus trapping/return, readable contrast, semantic names, 44px control hit areas, and long content/three-digit scores.
- Check production preview and installed/offline reload separately from the Vite dev server. Confirm all new art/fonts are cached and no remote runtime assets are needed.
- Measure frame time and decoded texture use under busy traffic. Keep static scenery cached, load only active map art, and avoid per-frame DOM updates except changing game values.
- Update `DESIGN.md` and its generated sidecar to describe the delivered system; align relevant `PRODUCT.md` presentation commitments. Remove abandoned replacement assets.

## 7. Definition of done

1. Opening the game immediately communicates “play an air-traffic game,” with the selected airfield visible and a dominant Play action.
2. Players can identify aircraft categories and their destinations without repeated wrong-runway experiments; color is not the only cue.
3. Terrain, airport, aircraft, HUD, and overlays share one visual language on every map.
4. Drawing is responsive, routes are legible, and UI does not intercept required airspace interactions.
5. Landing, danger, collision/escape, record, and promotion have distinct, truthful feedback.
6. A player can pause, inspect settings/help, resume, restart, or return to airfields without a navigation dead end.
7. Rotation and abandonment consequences are explained before progress is discarded.
8. Career, map locks, orientation-specific records, and settings remain compatible with existing saves.
9. The complete game is responsive and offline, with bounded motion and no increased per-frame terrain work.
10. All coverage gaps listed in section 2 are closed or explicitly reported at delivery; source inspection is never substituted for claimed browser verification.

## 8. Boundaries and risks

- This plan changes presentation and supporting navigation, not pacing, aircraft speeds, collision radii, capture tolerances, scoring, rank thresholds, or map geometry.
- Readability is the main art risk: brighter terrain cannot overwhelm semantic colors; more detailed aircraft cannot make collision boundaries misleading.
- Asset coherence is the main delivery risk: one strong map is a vertical slice, not completion. Ship the full atlas in the same language.
- Offline asset size and mobile texture memory need measurement before committing to large terrain plates for every orientation.
- Orientation-preserving simulation migration would be separate work. This plan first makes the existing restart behavior honest and understandable.
- Existing `.impeccable/design.json` is older than `DESIGN.md`. Refresh it with the final implemented design, not as an unrelated audit change.
