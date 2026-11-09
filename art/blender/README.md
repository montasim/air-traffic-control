# Blender assets for all twelve airfields

These experimental atlases are retained for future Blender authoring. The current game uses Three.js with the original map and aircraft drawing definitions; it does not load these replacement atlases. All maps use Three.js by default. Blender is an **offline authoring dependency**, not required to install, build, or play the game. The HTML/CSS menus, HUD controls, career screens, input settings, and save format remain shared with the existing application.

## Regenerate

From the repository root, with Blender installed:

```sh
npm run blender:layouts
npm run blender:assets
npm run build
```

Set `BLENDER_PATH` if the executable is not on PATH or in the usual Windows installation directory. `scripts/blender/map_assets.py` is the reproducible source for every kit. Assets were generated with Blender 5.2.3 LTS. No external models or artwork are required.

Each map directory contains an editable `<map-id>-kit.blend` and `layouts.json`. The latter includes eight final prepared layouts: landscape, portrait, square, and ultrawide, each with one-end and two-end landing, plus the serializable static artwork. These exports include the settled helipads, cleaned aprons, stands, and ground routes actually used by gameplay. The runtime continues preparing the exact viewport dimensions, including worlds restored from older saved shifts.

The shipped `public/assets/three/<map-id>/atlas.png` is a 512 × 512 RGBA atlas with a matching manifest. Each occupies 1 MiB per decoded CPU/GPU copy, without mipmaps. Meadow, desert, snow, passenger, freight, rescue, and naval palettes vary by map. Aircraft point along +X. Rotor blades are animated separately by Three.js.

## Current runtime

To preserve the original appearance, the game paints the original map definitions into canvas textures once and presents them through Three.js. See src/game/art/CanvasScene.ts, src/game/art/ThreeArtwork.ts, and src/game/three/MapWorld.ts. The original aircraft, cloud, water, route, and runway-guidance artwork remains in use. The experimental mapArt.ts composition and atlases are not the active presentation.

All 192 menu pictures use the same current compositor. Blender is not needed to build or play. Application dependencies contain no Phaser runtime.

## Verification and limits

- npm run build checks TypeScript, generates menu pictures, and builds the application and service worker.
- npm run test:three checks interaction, pause/resize/resume, renderer-load recovery, and context-loss recovery.
- npm run test:routes checks visible mouse/touch routes, labels, selection, runway locking, confirmation, and idle parked aircraft on all twelve maps.
- npm run test:performance checks the persistent Settings toggle and performance-panel placement.
- Browser checks default to port 4287; override RESIZE_TEST_URL when using another development server. Other browser scripts accept CHROME_PATH for an installed browser.
- The earlier under-30-MB total-memory target remains unmet. Displayed memory is an estimate; browser process CPU usage is unavailable. Do not interpret the development checks as physical-device memory certification.
