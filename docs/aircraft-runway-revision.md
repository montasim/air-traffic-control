# Aircraft, runway, and collision revision

2026-09-29 — response to visibly separated collisions and generic aircraft/runways.

## Collision diagnosis

The previous fatal-contact test compared center distance against two circular radii, ignoring aircraft heading and empty space around the airframe. A deterministic simulation regression places two parallel liners 12 units apart horizontally and 42 vertically: their airframes are separated, but the old 44-unit combined circle ends the shift. `npx vitest run tests/core/collision.test.ts` reproduced that failure before the fix.

Fatal contact now uses conservative, heading-aware airframe polygons. Phaser and the simulation receive the same per-type display scale, including mobile enlargement. Broad circles only discard distant candidates; they never cause game over. Proximity warnings remain independent and scale far enough ahead of possible contact. Shadows, selection rings, and helicopter rotor blur are not fatal surfaces. Aircraft already committed to landing retain their existing collision exemption.

Six regression cases cover the reported near miss, actual contact, heading, display scaling, warning-only proximity, and landing exemption. Fixed-step movement and existing spawn safeguards remain in place. This is a forgiving airframe approximation, not per-pixel alpha collision.

## Art

The original transparent atlas in `public/assets/arcade/aircraft-atlas.png` replaces the thick outlined geometric fleet. Passenger jet engines/windows, turboprop nacelles, helicopter skids/glazing, and a separate rotating rotor make categories recognizable. Cream metal and cyan/amber/coral livery continue the UI palette; runtime shadows share the airport lighting direction. Small-screen target sizes were reduced to keep the fleet from overpowering the field.

The shared runway painter now adds narrow shoulders, an inset asphalt course, numbered runway ends, paired touchdown blocks, edge lights, and restrained tire traces. All maps use the same treatment. The existing operational geometry remains authoritative.

Built-in imagegen created the atlas. The exact prompt and source identifier are saved in its adjacent `.png.json` file. The atlas is 1254×1254 with verified transparent alpha; runtime frames use its actual dimensions. The production service-worker precache includes it.

## Validation

222 tests across 24 files pass. TypeScript and the production build pass. Browser inspection verifies the new runway rendering and live aircraft artwork. A commuter route was accepted and completed a landing, reaching score 1. Collision regression is tested deterministically through the real simulation. Physical-device testing and exhaustive high-density play remain outside this check.
