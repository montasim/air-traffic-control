# Vector Approach

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Players looking for a focused, touch-friendly air-traffic routing game that works on desktop, tablet, and mobile without requiring an account or connection.

## Product Purpose

Vector Approach is a local-first regional routing game. Players choose one of four original airfields, draw paths from moving aircraft to compatible runways or a helipad, keep traffic separated, and build a controller career. Success means the next routing action is immediately understandable, each field changes the spatial challenge, and progress remains useful across short sessions on the same device.

## Positioning

The game combines one-stroke route drawing with an illustrated aviation arcade world. Saltmarsh Gateway, River Bend, Desert Parallel, and Twin Banks are original, offline maps with responsive code-native airport geometry and distinct geography. Shared local meadow and mineral materials support colorful miniature civil airfields. Cream controls, amber actions, recognizable aircraft, and contextual landing feedback keep the airfield central to the experience. The approved game presentation redesign supersedes the former graphite-panel and muted saltmarsh composition.

## Operating Context

The game is played full-screen with mouse, touch, or pen. Sessions are short, aircraft remain visible over the scenery, and the complete game must launch and reload as an installed PWA while offline. Career state stays local to the device: selected map, audio settings, total safe landings, shifts, earned clearance, and per-map best scores are persisted without an account or network service.

## Capabilities and Constraints

- Phaser and TypeScript power four original maps whose runways, landing zones, collision geometry, and responsive layouts remain code-native; terrain materials are bundled locally and remain presentation-only.
- Every map supplies responsive portrait, landscape, and near-square geometry while sharing the same aircraft types, landing semantics, guidance language, and offline rendering pipeline.
- The local career contains seven controller ranks. Saltmarsh Gateway and River Bend are available to a Control Trainee; Desert Parallel unlocks at Control Assistant; Twin Banks unlocks at Tower Controller; later ranks extend the career without hiding additional maps.
- Promotions combine cumulative safe landings, shifts played, qualifying best scores, and performance across distinct maps.
- Each map stores separate portrait and landscape best scores. The roster shows the higher map best, while the active HUD and game-over panel show the record for the current orientation.
- Semantic sound cues are synthesized with the Web Audio API for route connection, landing, collision, promotion, and interface confirmation. No sampled or streamed audio is required.
- Sound on/off and effects volume are player-controlled, synchronized across settings and pause controls, and saved locally.
- Gameplay, scoring, landing capture, route snapping, pacing, and aircraft selection behavior remain stable unless explicitly requested.
- No terrain, fonts, textures, audio, or gameplay assets may require a network request at runtime.
- Static scenery must not add per-frame work or obscure aircraft, routes, warnings, or landing guidance.
- DOM icons use Hugeicons only; in-world operational symbols may be drawn as map geometry.

## Brand Commitments

- Product name: Vector Approach.
- The visual foundation is an illustrated aviation arcade: cohesive meadow and sand scenery, cream supporting surfaces, amber actions, and original miniature civil airfields.
- Aircraft accents remain cyan, amber, and coral on every map.
- Barlow Condensed is the airfield/display face; Atkinson Hyperlegible is the interface face.
- The tone is concise, welcoming, and aviation-minded, with direct action labels and short routing instructions.
- Each biome is recognizable through terrain and water structure while shared illustrated materials, civil runway construction, cream paint, restrained taxiway detail, and contextual guidance keep the four maps in one family.

## Evidence on Hand

The runnable local project, its automated tests, the implemented four-map registry, local career and audio modules, and desktop/mobile/short-landscape review screenshots are the available evidence. No third-party game art, sampled audio, or copied map assets are part of the project.

## Product Principles

- Make the next routing action obvious without permanent visual clutter.
- Give each airfield a memorable geographic constraint without turning scenery into an obstacle system.
- Preserve generous interaction geometry while drawing believable physical infrastructure.
- Let every field explain itself through coherent runways, taxiways, aprons, access, facilities, drainage or river structure, and markings.
- Keep aircraft, routes, and guidance more prominent than every biome.
- Make career progress legible at map choice and preserve records for the orientation actually played.
- Use concise semantic sound as confirmation, never as a prerequisite for understanding state.
- Ship every map, font, icon, visual, sound, and saved-state feature fully offline and responsively.

## Accessibility & Inclusion

Respect reduced-motion and reduced-transparency preferences, safe areas, readable contrast, focus visibility, and live status announcements. Pointer gameplay must work with mouse, touch, and pen; do not claim full keyboard gameplay support. Sound must remain optional, adjustable, and redundant with visible feedback.
