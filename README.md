# Vector Approach

An offline-first air-traffic path-drawing game built with Phaser, TypeScript, and Vite.

The current vertical slice includes one original airport, three aircraft classes, touch and mouse route drawing, deterministic traffic simulation, collision and airspace-loss conditions, scoring, pause/restart controls, local IndexedDB records, and a fully pre-cached PWA build.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

The production build is written to `dist/`. It contains the complete runtime and service worker; the installed game does not require a network connection.

## Controls

- Press or click an aircraft and drag a route to its matching landing mark.
- Cyan airliners use runway 27.
- Amber commuter aircraft use strip 16.
- Coral rotorcraft use the helipad.
- Redraw an aircraft's route at any time.
- Press Escape or the pause control to hold the sector.

## Architecture

- `src/core/` contains framework-independent simulation and route geometry.
- `src/game/` contains Phaser presentation, input, and airport content.
- `src/storage/` contains local persistence.
- `tests/core/` contains deterministic simulation and geometry tests.

## Next implementation milestones

1. Add three more original maps and map selection.
2. Add puzzle scenarios and seeded local daily challenges.
3. Add special aircraft, progression, achievements, and save export/import.
4. Add locally bundled audio and accessibility settings.
5. Package the production build with Tauri for standalone desktop installation.
