# Night mode for all 12 maps

Date: 2026-11-05

Status: steps 1–4 implemented on 2026-11-05. No per-map tints were needed.

Verified: `npm test` (43 files, 1,065 tests), typecheck and `npm run build`. In the browser (desktop landscape): all 12 maps at night show runway edge lights, green landing ends with approach bars, red far ends, helipad rings and apron glows in the right places, including the carrier decks; a plane in flight shows its wingtip light on the correct side.

Not verified: the setting surviving a real reload (covered by the store test only), portrait phone layouts, Canvas renderer mode, the white strobe flash (too brief to catch in a screenshot), and the Android app.

## Why

Players of the competitor apps ask for more variety in how maps look. A night version of every map adds 12 new looks without a new layout, new rules or new records. It also gives a calmer, darker screen for evening play.

## The idea in one line

Don't repaint 12 maps. Draw one shared night layer **between the map art and the aircraft**, and place runway lights automatically from data every map already has.

Two facts from the code make this possible:

1. **Every map's art is drawn below depth 0.** Map art goes through `composeStaticMap` ([composer.ts](../src/game/rendering/shared-map/composer.ts)) at depth −20, and the other map painters use −20 to −8. Aircraft (including parked ones) are at depth 3, routes 4, warnings 6, approach labels and the HUD text 7 and up. A layer at depth 0–1 darkens the ground and nothing the player needs to read.
2. **Every map describes its runways the same way.** Each layout has `guidanceSurfaces` ([guidance.ts](../src/game/maps/shared/guidance.ts)): every runway with its centre, angle, length and width, and every helipad with its centre and radius. That is enough to place lights on any map, including the carrier deck.

## Ground rules (ponytail)

- No new dependencies. No new map art files. No per-map code unless a screenshot proves it's needed.
- Night changes **only how things look**. The simulation, spawns, scoring and difficulty are untouched, so night shares records with day: no new leaderboard columns, no new achievement rules.
- The save gains one boolean setting, normalised the same way as `twoEndLanding`. No schema version bump.
- Out of scope (named on purpose): an "Auto" mode that follows the device clock, night versions of the map previews on the home and map-picker screens, weather, a day-to-night transition during a shift, searchlights or moving lights, and night-only achievements.

---

## 1. The night layer (`src/game/rendering/NightRenderer.ts`, new)

One function, `drawNight(scene, layout)`, called from `PlayScene.create()` after the map is drawn. It returns a container so the scene can show or hide it.

### 1a. Darken (depth 0)

- One rectangle the size of the world, deep blue (`0x4a5a86`; the first try, `0x2a3550`, was too dark), blend mode **multiply**.
- Multiply darkens every colour in proportion: water stays blue, snow stays the lightest surface, sand stays warm. One rectangle covers all 12 maps.

### 1b. Lights (depth 1, blend mode **add**)

Built once from `layout.guidanceSurfaces` and drawn into a single render texture, so a frame costs the same as today.

For each runway surface:
- **Edge lights:** white dots along both long edges, about every 0.06 × runway length.
- **Threshold lights:** a row of green dots across each landing end, red across the far end. When both ends are in play (`twoEndLanding`) and the runway isn't `oneWay`, both ends get green.
- **Approach bar:** a short line of white dots out from each landing end along the runway axis.
- Each dot is a small bright core plus a larger faint halo, so it reads as a glow.

For each pad surface:
- A ring of yellow-green dots around the pad edge.

Aprons:
- Removed: a soft glow over each parking stand read like the collision warning ring around parked aircraft, so stands stay unlit.

### Changes

- `src/game/rendering/NightRenderer.ts`: new, about 80 lines. Light positions come from a pure helper, `nightLightPoints(surfaces, twoEndLanding)`, which returns `{ x, y, color }[]` so it can be unit tested without Phaser.
- `src/game/scenes/PlayScene.ts`: call `drawNight` in `create()`, keep the container, and add `setNight(enabled)` that shows or hides it. Start hidden unless the setting is on.

### Tests (`tests/game/nightLights.test.ts`, new)

- For one map from each category, every runway gets threshold lights within a few pixels of both runway ends.
- A `oneWay` runway (Carrier Coast) gets red at its far end even with `twoEndLanding` on.
- A helipad gets a ring whose points are all `radius` from its centre.
- The existing map contract test already builds every map, so a map that crashes the night layer fails there.

---

## 2. Aircraft navigation lights (`src/game/rendering/AircraftView.ts`)

- Add three small dots to the aircraft container: red on the left wingtip, green on the right, and a white light that flashes about once a second.
- Hidden unless night is on. `AircraftView` gets `setNight(enabled)`, the same way it already has `setReducedMotion`.
- With reduced motion on, the white light stays steady instead of flashing.
- The aircraft body keeps its full colour, because colour tells the player where a plane lands. The lights are small enough not to change that.
- Wingtip positions come from each outline's half-width (`AIRCRAFT_OUTLINES`); helicopters get one red and one green light on the body sides.

About 25 lines.

---

## 3. The setting and the switch

### Behaviour

- A **Night** switch on the start panel, below "Land at both runway ends", using the same `runway-option` markup and styles.
- Because the night layer is just shown or hidden, flipping the switch changes the live map behind the start panel at once. **No game rebuild**, unlike the landing-ends switch.
- The choice is saved, so night stays on for the next session.
- A resumed shift uses the current setting. It isn't stored in the saved shift.

### Changes

- `index.html`: the switch (`#night-mode`), with a short description: "Darken the map and turn on runway and aircraft lights."
- `src/storage/gameSave.ts`: `settings.night: boolean`, default `false`, normalised as `settings.night === true` in every place `twoEndLanding` is.
- `src/storage/gameStore.ts`: `setNight(enabled)`, a copy of `setTwoEndLanding`.
- `src/main.ts`: wire the switch like `landingModeInput` (disable while saving, restore focus), call `playScene.setNight(...)` on change and on scene ready.
- `src/game/scenes/PlayScene.ts`: `setNight` also calls `setNight` on every aircraft and ground view, and new views take the current value.

About 30 lines.

### Tests

- `tests/storage/gameSave.test.ts`: an old save without `night` loads with `night: false`; a non-boolean value becomes `false`.
- `tests/storage/gameStore.test.ts`: `setNight(true)` persists and the save still passes the seal.

---

## 4. Screenshot pass and per-map touch-ups

- Capture all 12 maps, portrait and landscape, night on, with traffic in the air. Reuse the existing Playwright resize script's setup to drive this (Edge via `CHROME_PATH`).
- Check on each: destination colours are still easy to tell apart, landing targets and route lines stand out, map labels (city names, "H" on rescue pads) can still be read, and the lights line up with the runways.
- Only if a map looks wrong: give that map an optional `nightTint` in its definition (for example Blue Water's ocean too dark, or Frost Crossing's snow too grey), which `drawNight` uses instead of the default blue. One line per map. **Add none before seeing screenshots.**

---

## Order and size

| Step | What | Size |
| --- | --- | --- |
| 1 | Night layer and runway lights | ~80 lines + test |
| 2 | Aircraft navigation lights | ~25 lines |
| 3 | Setting, switch, save | ~30 lines + 2 tests |
| 4 | Screenshots, any per-map tints | 0–12 lines |

Steps 1 and 2 can be checked with the layer forced on before the switch exists. Each step ships on its own.

## Risks

- **Multiply in Canvas mode.** The game uses `Phaser.AUTO`, so WebGL on almost every device. Canvas supports multiply too, but the look may differ slightly. Check one map with `type: Phaser.CANVAS` during step 1.
- **Map labels get darker.** Text drawn as map art (Coastal labels, rescue "H" marks) sits below depth 0 and is darkened with the map. If screenshots show it's hard to read, move those labels above the night layer.
- **Small phones.** Lights are sized from the world size, the same way the map art is; check the smallest portrait layout in step 4.
- **Battery.** The lights are one texture drawn once, so no per-frame cost apart from the flashing aircraft light, which is a visibility toggle.
