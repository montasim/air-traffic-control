# Migration status ? 2026-11-09

All 12 maps now use the Three.js runtime. The legacy engine and its dependency have been removed. See [the Blender asset guide](../art/blender/README.md) for the current pipeline, scope, validation, and remaining artwork/memory limitations.

The current renderer preserves the original map and aircraft artwork through canvas textures and Three.js. The Blender atlases remain experimental and are not loaded by gameplay. Performance stats are controlled from Settings, and effects volume alone controls mute/unmute. The earlier under-30-MB memory target remains unmet.

The plan below records the initial Saltmarsh prototype and is historical; its opt-in/fallback, atlas-runtime, and always-visible diagnostics instructions no longer apply.

---

# Saltmarsh Gateway: Blender and Three.js implementation plan

Date: 2026-11-08

Status: initial implementation slice delivered on 2026-11-08. Three.js is opt-in; the complete migration and memory certification are not finished.

## Implementation record — first slice

Implemented:

- Engine-independent application/runtime contract and shared session ownership for simulation, saves, and achievement tracking. Phaser now runs behind an adapter. Both engines are loaded on demand, and map-preview rendering is lazy and suspended during active shifts.
- Typed access to final prepared Saltmarsh geometry, including the apron/helipad/ground-route adjustments. Offline tooling exports eight reference configurations for Blender; tests compare the geometry with the existing map definition.
- A reproducible Blender 5.2.3 LTS script, editable `.blend` source, 512 × 512 transparent prototype atlas, and manifest. The atlas occupies 1,048,576 decoded RGBA bytes per CPU/GPU copy, without mipmaps. This first slice uses moving pre-rendered aircraft sprites; GLB aircraft and final artwork remain future work.
- An opt-in Three.js runtime using existing simulation rules, route targeting, aircraft selection, ground traffic, and save operations. Static geometry is batched; the drawing buffer is capped at 500,000 pixels independently of CSS size. Route buffers are bounded. Missing atlas/graphics initialization recovers to Phaser.
- Top-right diagnostics for both runtimes: estimated memory and sampled session peak, FPS, frame timing, tracked update costs and calls/second, and Three.js draw calls. Process CPU metrics are marked unavailable. Sampling is twice per second, with explicit unknown/unverified/over-limit states and session resets.
- A fixed-world pointer transform, retained-world pause/resize/resume behavior, PNG size validation before atlas decoding, resource disposal, and regression scripts.
- A small existing interaction fix: dismissing More menus now occurs on click rather than pointerdown, so closing a menu cannot move Restart away between press and release.
- Phaser destruction is scheduled before waking a sleeping loop, preventing an old canvas from surviving a rebuild. Repeated runway-mode checks assert that exactly one gameplay canvas remains.

Validation performed:

- `npm test`: 52 files, 1,485 tests passed. Subsequent focused runtime/preview tests and type checking passed after final diagnostics adjustments.
- `npm run build`: passed, including generated menu pictures and PWA output.
- `npm run test:three`: real Three.js canvas, route drawing through pointer input, diagnostic/HUD placement, pause/resize/resume at desktop, phone-sized, and square viewports; missing-atlas fallback passed.
- `npm run test:resize`: the existing Phaser routed-flight, resize, dialog, and restart regression passed.
- `npm run test:runway-mode` passed, including repeated toggles and the one-canvas assertion. Pointer-drawn commuter approaches to both ends passed; after the disposal fix, the affected liner checks passed at both ends, including resizing during approach.
- A short optimized-build profile with the overlay visible produced sampled combined estimates below 20 MB on this host. This is a ten-second smoke profile per viewport, with no forced garbage collection; it does **not** establish worst-case memory or physical-device compliance. Development/HMR runs exceed 30 MB and are explicitly reported as over limit.
- Host tools used Node 26.13.0/npm 11.20.0; the repository requests Node 24. Recheck the release workflow on the supported Node version before rollout. Browser checks used installed Microsoft Edge because the Playwright-managed Chromium binary is not installed.

Try the prototype with `npm run dev`, then append `?renderer=three` to the application URL. Phaser remains the default. The diagnostics panel is also present on normal Phaser gameplay; its existing memory use is not claimed to satisfy the new backend's budget.

Asset commands: `npm run blender:layouts` exports final geometry; `npm run blender:assets` rebuilds the atlas and editable scene using the installed Blender. Set `BLENDER_PATH` if automatic executable discovery is unsuitable. Normal application builds do not invoke Blender.

For an optimized profiling build in PowerShell:

```powershell
$env:VITE_THREE_PROTOTYPE = '1'
npx vite build --outDir dist-three-profile
npx vite preview --outDir dist-three-profile --port 4288
```

In another terminal, run `node scripts/profile-three-memory.mjs`. Reports and test screenshots are written under ignored `test-results/three/`. The profiling build is also ignored. Remove the environment variable afterward (`Remove-Item Env:VITE_THREE_PROTOTYPE`) to return to the normal release configuration.

Remaining release gates:

- Finish extraction/reuse of input decisions; the first Three.js input adapter still has presentation-specific handling distinct from the Phaser adapter.
- Finish Blender scene art and model/animation production. The slice uses simplified scenery assembly and sprite aircraft; water modulation and night tint are placeholders, not final water animation or baked night lighting. Add cloud/aircraft shadows, rotor/propeller animation, and livery parity.
- Complete route stroke styling, guidance transitions/labels, hold rings, landing/failure feedback, ground fading, and other presentation parity checks. Existing simulation rules remain shared, but complete visual and interaction equivalence is not claimed.
- Validate the 30 MB limit over sustained peak traffic, settings changes, restoration, context loss, and repeated switches from Phaser maps. Imported Phaser code may remain resident after switching maps; lazy loading does not unload a previously imported engine.
- Account for native/driver allocations and decoded UI images that the initial ledger cannot reliably enumerate. The overlay intentionally reports estimates and keeps compliance unverified even when a short sample is below the limit.
- Verify physical Android/WebView, desktop packaging, offline asset recovery, and all-map regressions before enabling Three.js by default.

## Outcome

Replace Phaser rendering and runtime orchestration for Saltmarsh Gateway with Three.js, using Blender to author and pre-render static scenery. Keep the current HTML/CSS UI visually unchanged and preserve gameplay, saves, progression, audio, accessibility, and resize behavior. Keep all other maps working through the existing Phaser backend during this migration.

Blender is already installed. Locate its executable and record its version in the asset build configuration; installation is not a prerequisite task. Blender runs during asset production, never on players' devices or during ordinary application startup.

## Hard gameplay memory limit

User requirement: game-owned CPU and GPU memory combined must remain below **30 MB (30,000,000 bytes)** during gameplay. This includes paused/resumed gameplay and settings transitions. This is a release gate, not an optimization target to defer until after artwork is finished. Early smoke measurements are recorded above; full compliance remains unverified.

Count application/engine JavaScript heap, simulation and UI state, asset buffers, retained decoded images, GPU textures and mipmaps, geometry buffers, render targets, and attributable drawing/depth buffers. Count CPU and GPU copies separately when both exist. Include any retained Phaser runtime or menu-preview resources while Saltmarsh is active. Browser/WebView/Electron baseline overhead unrelated to game-owned resources is excluded; a low JavaScript heap measurement alone does not demonstrate compliance.

Use an initial **24 MB working budget**, leaving **6 MB headroom** under the hard limit for allocation peaks and measurement uncertainty:

- Application/engine heap, UI, simulation, and CPU-side asset data: 10 MB.
- Resident GPU textures, including mipmaps: 6 MB.
- Drawing buffers, depth buffers, and render targets: 6 MB.
- GPU geometry and other tracked allocations: 2 MB.

These are provisional allocations, not measured usage. Rebalance them only while preserving the combined cap and headroom. If the minimal runtime cannot fit, report the measured blocker before expanding the implementation; do not silently relax the requirement.

Implementation constraints:

- Add a conservative resource ledger and memory profiling in the first Three.js slice. Track current and peak bytes, ownership, load/disposal events, and CPU/GPU duplication. Three.js object counts alone are insufficient; account for texture formats, mip levels, render-target dimensions, and renderer drawing buffers. Corroborate the ledger with available heap and graphics profiling, and disclose platform-specific measurement gaps.
- Determine canvas resolution from the memory budget as well as viewport size. Do not inherit the current 2.5 render-scale ceiling as a default. Prefer a single drawing target, disable unnecessary depth/stencil/MSAA and post-processing, and lower internal resolution before exceeding the budget. Keep HTML/CSS UI resolution unchanged.
- Use small shared atlases, reusable materials, lightweight aircraft meshes, and reusable geometry. A 2048 × 2048 RGBA8 texture alone occupies 16,777,216 bytes before mipmaps or CPU copies; compressed download size is not resident memory usage.
- Prefer supported GPU-compressed textures where useful, with a separately budgeted fallback. Include decoder/transcoder working memory and staging buffers in peak accounting. Avoid large animation frame atlases and full-screen day/night image pairs resident together.
- Dispose decoded images and temporary asset buffers when no longer required; use bounded pools for routes and effects. Establish a context-restoration strategy that reloads discarded assets rather than retaining duplicate full-resolution copies.
- Load only the current map and required assets. Do not preload other maps during gameplay. Release menu captures and old backend resources; test switching from a Phaser map because unloading a canvas does not necessarily reclaim imported JavaScript code.
- Budget weather/night changes and asset replacement before allocating. Keep transition overlap within the cap, using staged replacement or lower-resolution assets when necessary. Do not rely on forced garbage collection to pass normal gameplay measurements.

Memory acceptance: exercise maximum configured aircraft/ground traffic, long route drawing, all effects, day/night and weather changes, pause/resume, resize/DPR changes, shift restoration, and repeated map switches. Record peak combined game-owned memory on reference desktop and Android configurations. Each must remain below 30,000,000 bytes with no upward retained-memory trend. If profiling cannot establish a reliable combined bound, mark compliance unverified rather than claiming success.

## Architecture and boundaries

- Reuse `src/core/Simulation.ts`, route targeting, collision rules, difficulty, progression, storage, and audio. Presentation changes must not alter these rules.
- Introduce an engine-independent session controller and runtime interface. Adapt Phaser first, then implement a Three.js runtime using the same controller. Avoid maintaining two copies of route assignment, scoring, or pause/save logic.
- Keep `src/main.ts`, `src/ui/`, and `src/styles.css` responsible for the current UI. Replace direct `Phaser.Game` and `PlayScene` dependencies in application wiring with the runtime interface.
- Separate map preparation from backend rendering. `MapDefinition.render` currently requires `Phaser.Scene`; introduce backend-specific rendering registrations without changing map IDs or save keys.
- Load the selected backend on demand. Run only one gameplay renderer and one simulation clock at a time. Destroy the previous runtime when switching maps.
- Render Saltmarsh with a fixed orthographic camera aligned to the existing logical X/Y coordinates. Preserve screen-space aircraft sizing and hit areas. Camera tilt, zoom controls, and gameplay in three dimensions are outside this scope.

## Live gameplay diagnostics overlay

User requirement: show a compact diagnostics panel at the top right while gameplay is running. Include it in the first playable Three.js slice and retain it in the completed Saltmarsh implementation; it is not limited to development builds.

- **Memory:** current and session-peak combined game-owned CPU/GPU memory against the 30 MB limit, with separate CPU and GPU figures. Label estimates explicitly and distinguish accounted resource bytes from sampled heap measurements; do not double-count buffers already included in heap totals. Display budget pressure clearly without relying only on color.
- **Process/CPU activity:** show measured game update and render-submission time in milliseconds per frame, plus their share of the frame budget. Browser APIs do not provide portable process CPU percentage or total process memory. Display those native process metrics only where a supported desktop bridge exposes them; otherwise label them unavailable. Do not present frame-budget utilization as operating-system CPU usage, or CPU render-submission time as GPU execution time.
- **FPS:** rolling FPS and frame time in milliseconds, with a recent slow-frame indicator. Stop/reset the sampling window on pause and visibility changes so background throttling does not corrupt active-gameplay figures.
- **Function-call usage:** instrument selected game systems and show calls per second and sampled execution time for simulation updates, aircraft synchronization, route/guidance updates, and environmental effects. Separately show Three.js draw calls per frame. Label the scope; these are tracked system calls, not a count of every JavaScript function call. Avoid wrapping all functions or retaining call traces.

Placement and behavior:

- Anchor inside the gameplay viewport at the top right, respecting safe-area insets. Place below the existing best-score HUD or within reserved space so neither component overlaps or changes its existing appearance.
- Use a compact HTML/CSS overlay with legible text and a narrow-screen layout. It must not intercept route-drawing gestures; use `pointer-events: none` for the read-only panel. Do not announce rapidly changing values through an ARIA live region.
- Refresh displayed values approximately twice per second while collecting inexpensive per-frame counters. Use fixed-size rolling buffers, reused text nodes, and bounded instrumentation. Avoid per-frame DOM rebuilding and logs.
- Show a paused state when the shift pauses; hide the panel outside gameplay. Reset session peaks/counters on a new shift and preserve their meaning during resize/resume.
- Include all overlay memory and processing overhead in the game's budgets. Measure the overhead with instrumentation enabled and disabled; the shipping configuration must satisfy the below-30-MB limit with the overlay visible.

Acceptance: the panel is visible and readable during active Saltmarsh gameplay on desktop and mobile, leaves the existing HUD and routing usable, reports clearly scoped metrics, handles unsupported measurements honestly, and remains bounded during long sessions. Validate counters against known update/draw workloads and the resource ledger. Add this panel during Phase 3, complete subsystem instrumentation during Phases 4–5, and verify accuracy and overhead during Phase 6.

## Asset strategy

Static terrain, buildings, trees, pavement, and decorative shadows are rendered in Blender and displayed as unlit textured layers in Three.js. Use modular assets instead of one stretched screenshot of the airport. Static objects remain pre-rendered even when their textured planes are assembled at runtime.

Aircraft use lightweight Blender-authored GLB models, with animation for rotors and propellers as appropriate. Flight positions and headings remain controlled by the existing simulation. Clouds use transparent pre-rendered textures translated at runtime, with separate moving shadow layers. Water uses a subtle animated texture or shader clipped to the tidal pool polygons. Route strokes, landing guidance, warnings, selection feedback, and moving aircraft shadows remain runtime graphics.

Do not bake aircraft, cloud shadows, active guidance, or water highlights into the static map. Provide day/night static asset variants where lighting differs; a dark overlay cannot remove baked daytime shadows. Match color management and lighting across static and dynamic assets.

### Responsive geometry contract

The layout supports portrait, square, and landscape variants, but it also depends on exact world dimensions. The viewport expands a logical world to fit the initial aspect ratio. Three full-map images alone are therefore insufficient.

Use final prepared geometry as the source of truth, including site cleanup, bidirectional landing mode, apron markings, ground routes, and settled helipads. `defineMap` currently hides the rich layout in a `WeakMap`; expose a typed, read-only presentation description through the preparation pipeline rather than rebuilding or casting a partial layout in the renderer.

Export that description to JSON for Blender reference scenes and asset alignment checks. Include world dimensions, coordinate convention, runway endpoints and widths, pavement polygons, helipad center, building anchors, pools, stands, and stable IDs. Asset manifests additionally record image dimensions, world-space bounds, pivots, layers, lighting variant, and version/hash.

Use baked tileable materials on exact pavement/terrain polygons, modular runway marking and building assets, and separate shoreline layers. Assemble changing stand/taxiway markings from pre-rendered atlas elements using final geometry. This preserves shape and placement without stretching an entire airport or regenerating images for arbitrary user viewport sizes.

## Phase 1 — Baseline and runtime contract

1. Inventory every application call into `PlayScene` and Phaser: lifecycle, input, speed, night/weather, active-shift export/import, HUD events, feedback, frame capture, menu previews, and development diagnostics.
2. Record a representative Saltmarsh baseline: portrait, landscape, square/near-square, ultrawide, day/night, both landing modes, and each aircraft type. Capture existing UI appearance and gameplay behavior using the repository's test workflow.
3. Define the runtime contract around those callers, including ready/loading/error states, start/pause/resume, state export/import, settings, resize/fit, frame capture, subscriptions, and disposal.
4. Extract engine-independent session/input decisions from `PlayScene`. Keep screen-to-world conversion and rendering in each backend.
5. Implement the Phaser adapter and route existing application calls through it before adding Three.js.

Deliverable: the existing application runs through the new contract with no intended behavior change. Existing tests and build pass. Simulation state can be replayed without a renderer.

## Phase 2 — Blender pipeline and geometry proof

1. Add an explicit Blender executable configuration with local discovery and a useful missing-path error. Record the tested Blender version and render settings.
2. Add a TypeScript geometry exporter and Blender Python scene/build script. Generate reference geometry from final prepared layouts, including both landing modes.
3. Create an editable Saltmarsh `.blend` source with organized terrain, airport, vegetation, building, water-mask, and lighting collections. Keep the existing airport arrangement and open routing space.
4. Produce a small representative asset kit first: ground material, runway surface and markings, one building, a tree, a cloud, and one aircraft. Establish camera projection, scale, transparency, pivots, and color matching before polishing the entire map.
5. Export production textures/atlases and GLB assets with a versioned manifest. Keep source scenes under `art/`; ship only runtime assets under `public/assets/`.
6. Make asset generation an explicit command, separate from normal `npm run build`, so application builds do not require Blender or expensive rendering.

Deliverable: reproducible assets and an alignment fixture demonstrating that the same asset kit fits multiple exact world sizes. Do not proceed to full art production until runway edges, helipad, stands, and building positions agree with prepared geometry.

## Phase 3 — Three.js Saltmarsh rendering slice

1. Add Three.js and appropriate TypeScript support using versions verified at implementation time. Create a lazily loaded Saltmarsh runtime behind an internal development flag.
2. Implement orthographic projection, capped rendering resolution, asset loading, deterministic layer ordering, resizing, and complete resource disposal.
3. Assemble static scenery from final geometry and the asset manifest. Keep baked colors unlit; configure color space and tone mapping deliberately.
4. Render one moving aircraft from simulation snapshots with its correct heading, apparent size, and shadow. Add a coordinate overlay for runway boundaries, landing capture regions, and collision outlines in development builds only.
5. Wire the existing HUD and pause/resume controls through the shared controller. Retain a working Phaser fallback while the slice is incomplete.

Deliverable: a playable Saltmarsh slice with one aircraft type and unchanged UI. Pointer selection, route coordinates, runway alignment, pause/resume, and resizing work before detailed effects are added. Establish measured memory headroom for the remaining aircraft and effects before continuing full asset production.

## Phase 4 — Full interaction and presentation parity

1. Port route strokes, replacement previews, landing guidance, warnings, failure markers, and any canvas labels. Match current fonts, colors, widths, timing, and draw order.
2. Use browser pointer events with pointer capture, cancellation, touch handling, and existing selection precision rules. Map CSS coordinates through the fitted canvas into the fixed logical world, independent of device pixel ratio.
3. Add liner, commuter, and rotor presentation, existing livery choices, landing transitions, rollout, taxiing, and parking. Keep visual footprints aligned with collision and selection geometry.
4. Preserve speed controls, pause behavior, reduced motion, feedback/audio events, shift restoration, achievements, and record accounting. Restore saves with either backend using the same gameplay schema.
5. Preserve the established resize contract: retain world geometry and committed routes during an active shift; cancel partial strokes and pause when required; fit the retained world; require valid conditions and explicit resume. Only new shifts adopt a new layout.
6. Adapt menu/live preview capture and diagnostics that currently access Phaser directly. Capture a completed frame without keeping an unnecessary second renderer alive.

Deliverable: all existing Saltmarsh interactions function through Three.js, including saved-shift restoration and both runway-end modes.

## Phase 5 — Complete art and environmental animation

1. Finish the Saltmarsh scenery kit and all supported lighting variants in Blender. Preserve clear visual separation between aircraft, paths, and scenery.
2. Add drifting cloud textures and shadows, preserving weather settings and thinning over the airfield.
3. Add masked water animation with no shimmer spilling onto the banks or airport. Prefer a small reusable animated material over large frame sequences.
4. Add aircraft propeller/rotor motion and night lights, respecting reduced motion and the existing pause/settings behavior.
5. Tune dynamic lighting and shadow placement to match the baked scene. Keep cloud transparency and draw order from hiding interaction feedback.

Deliverable: the intended Blender-rendered appearance with moving aircraft, clouds, and water, plus day/night and weather parity.

## Phase 6 — Verification, performance, and rollout

Run the repository-required `npm test` and `npm run build`. Add focused coverage for the new runtime contract, coordinate conversion at fitted sizes/DPRs, retained-world resizing, asset bounds/pivots, and state continuity across backend restoration. Use existing simulation tests rather than duplicating gameplay rules in rendering tests.

Adapt and run applicable integration checks: `test:resize`, `test:resize:maps`, `test:runway-mode`, `test:runway-ends`, `test:mobile-boot`, and the desktop build/smoke workflow. Verify that test configurations exercise the actual Three.js backend instead of silently falling back to Phaser. Validate Android using the existing build/sync workflow and an available device or emulator; record any unavailable platform coverage.

Acceptance checks:

- Existing UI retains layout, typography, controls, keyboard focus, and accessibility behavior; gameplay artwork is the intended visual change.
- Every aircraft can be selected, routed, landed, rolled out, and parked where the displayed map indicates. Both landing modes work.
- Orientation changes, tiny windows, high DPI, dialog openings, background/foreground changes, restart, and repeated map switches preserve the current behavior and do not leak handlers or GPU resources.
- Existing saves, scores, ranks, achievements, audio settings, and livery settings remain compatible.
- Day/night assets and weather changes stay aligned. Water remains confined to its polygons. Reduced motion works.
- Production/PWA asset paths, caching, offline replay after caching, and desktop/Android packaging include required files. Asset failure and unsupported graphics initialization produce a controlled fallback, not a blank field or duplicate shift.
- Measure startup, asset transfer size, combined game-owned CPU/GPU memory, draw calls, and frame-time percentiles against Phaser on the same hardware and seeded workload. Enforce the hard memory limit and profiling matrix above. Target stable 60 fps on the agreed reference desktop and Android devices; treat this as a target until measured. Refine the provisional asset budgets after the first rendering slice without increasing the combined limit; reduce resolution/effect complexity where measurements require it.

Enable Three.js for Saltmarsh by default only after parity checks pass. Retain an internal backend override for diagnosis and rollback. Keep Phaser available for the other maps; complete Phaser dependency removal requires a separate all-map migration.

## Proposed implementation locations

- `src/game/runtime/`: shared runtime contract, session controller, backend selection, Phaser adapter.
- `src/game/three/`: Three.js runtime, projection/input conversion, asset loading, Saltmarsh scenery, aircraft, guidance, environmental effects.
- `src/game/maps/saltmarsh-gateway/`: presentation description derived from final prepared geometry.
- `scripts/blender/`: geometry export, Blender scene generation/rendering, asset packaging and validation scripts.
- `art/blender/saltmarsh-gateway/`: editable scene, source assets, render settings, and provenance.
- `public/assets/three/saltmarsh-gateway/`: runtime textures, models, and manifest.
- `tests/game/`: focused runtime, alignment, and restoration regression coverage.

Names are proposed; reuse existing modules where their responsibilities already fit.

## Delivery order and completion boundary

Work sequentially: runtime seam → geometry and asset proof → playable Three.js slice → full gameplay parity → final art/effects → platform verification and Saltmarsh rollout.

The first reviewable milestone is the playable slice with unchanged UI and correct routing/landing alignment. The migration is complete when Saltmarsh uses Three.js by default with the documented parity checks satisfied, assets reproducibly build from Blender sources, and the remaining Phaser maps continue to work. This plan does not authorize publishing, store submission, or migration of additional maps.
