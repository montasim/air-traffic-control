# Game speed, holding, a sealed save, and resuming a shift

Date: 2026-11-05

Status: all four steps implemented on 2026-11-05.

Verified: `npm test` (41 files, 1,048 tests), `npm run build`, and `npm run test:resize` (Edge via `CHROME_PATH`). In the browser: the speed button cycles 1× → 2× → ½× with matching labels; pausing writes a sealed shift; after a reload, Resume shift restores the same run id, game time and aircraft; Main menu → leave deletes the saved shift; an edited saved shift is discarded; an edited career save shows the "changed outside the game" note and keeps its data.

Not verified in a real play session: the tap-to-hold gesture and the hold ring (the browser pane was hidden, which throttled game time; the simulation side is covered by unit tests), the speed button's fit on a portrait phone, and the Android app being swiped away.

## Why

Competitor reviews (Air Control 1/2, Airport Control 1/2; about 1,650 Play reviews read on 2026-11-05) ask most often for three things this game lacks:

1. **Speed control.** Players want fast-forward for slow openings, and a slower pace for beginners and disabled players.
2. **Not losing a shift.** Runs are lost when the app is closed, interrupted, or killed in the background.
3. **More control over a plane.** Players want to circle or hold it, or go around, instead of being stuck with a bad approach.

A fourth item comes from our own review: scores live in a plain IndexedDB record that anyone can edit in DevTools. A **local save seal** detects those edits. It's built before the resume step, because the saved shift uses the same seal.

Build them in this order: speed, hold, seal, resume. Each one ships on its own.

## Ground rules (ponytail)

- No new dependencies. No changes to the `GameSaveV3` schema or migrations. No new settings screen.
- The simulation stays deterministic and keeps its fixed 1/60 s step.
- Every new behavior in the simulation gets a unit test in `tests/core/Simulation.test.ts`.
- Out of scope (named on purpose): rewind/paid continues, a saved speed preference, restoring planes that are taxiing on the ground, altitude levels, crash replay, a confirmation dialog before discarding a saved shift, server-side score checks, a backup copy for undoing an edit, and protection against editing memory during a run.

---

## 1. Game speed: ½× / 1× / 2×

### Behaviour

- A new HUD button next to Pause cycles **1× → 2× → ½× → 1×**. Its label shows the current speed (`1×`, `2×`, `½×`).
- The choice lasts for the session, so the next shift keeps it. It isn't saved to disk.
- Speed changes how fast simulation time passes, not the rules. Spawn timing, scoring and difficulty are all measured in simulation time, so a shift at ½× has exactly the same traffic, just slower.

### Changes

| File | Change |
| --- | --- |
| `src/game/scenes/PlayScene.ts` | Add `private timeScale = 1` and `setTimeScale(scale: number)`. In `update()`, compute `const scaled = deltaMilliseconds * this.timeScale` and pass `scaled` to `simulation.update`, `syncAircraft` and `syncGroundTraffic`. Keep `routeGuidance.update` and `updateGuidanceTimeout` on real time, because UI hints shouldn't speed up. |
| `index.html` | Add `<button id="speed-button" class="icon-button" type="button" aria-label="Game speed: normal" disabled>1×</button>` in the `.hud` header before `#pause-button`. |
| `src/main.ts` | Add `const SPEEDS = [1, 2, 0.5]` and `let speedIndex = 0`. On click, advance the index, call `playScene()?.setTimeScale(...)`, update the label and aria-label ("Game speed: double / half / normal"), and `announce()` it. Apply the speed in `beginRun` and after a restored shift. Enable and disable the button wherever `pauseButton.disabled` is toggled. |
| `src/styles.css` | Only if needed: make `#speed-button` text match the icon-button size. |

`Simulation.update` already caps each frame at `MAX_FRAME_DELTA` (0.1 s). At 2× a normal 60 fps frame is 0.033 s, well under the cap. A long frame hitch at 2× is capped, which only slows the game briefly. That's safe and needs no change.

### Checks

- No simulation test: the simulation itself doesn't change.
- Browser: at 2× the score clock (`elapsed`) advances twice as fast and the rotors spin faster. At ½× it's half speed. Ground taxiing follows the same speed.
- Phone portrait (390×844): the HUD still fits and doesn't cover `hudExclusionZones`. Screenshot every map's portrait layout once.

---

## 2. Holding and go-around (tap a plane)

### Behaviour

- **Tap** a flying aircraft (press and release without drawing) to make it **hold**. It drops any route and circles where it is.
- Tapping a plane that's on an approach route is the **go-around**: same gesture, same result.
- **Drawing** a new route from a holding plane releases it, using the normal route rules.
- Holding planes still collide and still trigger warnings. Holding is a tool, not a shield.
- A holding plane with no destination that crosses its own matching runway end lands, the same as an unrouted plane today. That's fine.

### Simulation design

- `Aircraft` gets `holding?: 1 | -1`, the turn direction.
- The circle has a fixed radius, `HOLD_RADIUS = 48` world units. The turn rate is `speed / HOLD_RADIUS`, so all aircraft types fly the same size circle.
- The turn direction is always **toward the centre of the airspace** (the sign of the cross product of the heading and the vector to the bounds centre). The farthest a plane can travel outward is then one radius (48), which is less than the airspace-exit margin (82). A plane holding anywhere inside the airspace can't trigger an airspace game-over.
- A hold is rejected for aircraft still `entering` (`!hasEntered`), for aircraft that are `landing`, and when the phase isn't `running`.

### Changes

| File | Change |
| --- | --- |
| `src/core/types.ts` | Add `holding?: 1 \| -1` to `Aircraft`. |
| `src/core/Simulation.ts` | Add `holdAircraft(id): boolean`. It checks the rejection rules above, then sets `route` and `approachZoneId` to `undefined` and sets `holding` toward the centre. In `advanceAircraft`, when `holding && !route`: `heading += holding * (speed / HOLD_RADIUS) * delta`, move `speed * delta` along the heading, then run the existing entered check and return. In `assignRoute`, an accepted route sets `holding = undefined`. |
| `src/game/scenes/PlayScene.ts` | In `handlePointerUp`, before `assignRoute`: if the drawn path is shorter than about 10 world units (the sum of `distance` between `drawnPoints`), call `simulation.holdAircraft(aircraft.id)`, `announce("Holding")` and return. Longer short strokes keep today's "draw a longer path" rejection. In `drawRoutes`, draw a thin ring of `HOLD_RADIUS` in the aircraft colour around each holding aircraft's circle centre (position plus the perpendicular times radius times direction), so the player can see which planes are waiting. |
| `index.html` (`#help-content`) | Add one line: "Tap an aircraft to hold it in a circle. Draw a new route to release it." |

### Tests (`tests/core/Simulation.test.ts`)

1. **Hold stays in its circle:** after a hold, 10 s of steps keep the aircraft within `2 × HOLD_RADIUS` of where it started.
2. **Hold at the edge is safe:** an aircraft just inside the edge heading outward, then held, survives 10 s with no `gameover` event.
3. **Hold is rejected** for a `landing` aircraft and for one that hasn't entered yet.
4. **A route releases the hold:** after `assignRoute` is accepted, `holding` is `undefined` and the aircraft follows the route.

---

## 3. Seal the local save

### What it does and doesn't do

- **Does:** catches anyone who edits the career save outside the game (DevTools, the browser console, editing files on a rooted phone) and permanently marks that save **modified**.
- **Doesn't:** stop someone who finds the key in the game's code, or who changes values in memory during a run. The key ships with the game, so this is a deterrent, not a lock. Only a server replaying each run (not in this plan) can make shared scores trustworthy.
- **Never deletes data.** A bug in the seal must not wipe anyone's career, so a broken seal only flags the save. It doesn't reset it.

### Design

- **Seal:** a keyed hash, `cyrb53(SEAL_KEY + canonicalJson(save))`, stored as a `seal` field next to the save data in the same IndexedDB record.
  - It's **synchronous** (about 10 lines, no dependency, no Web Crypto). That matters because step 4 writes the saved shift during `pagehide`, when an async hash might not finish before the page is frozen.
  - HMAC wouldn't be safer here: the key is in the game's code either way, and the weak point is the key, not the hash.
- **`canonicalJson`:** `JSON.stringify` with object keys sorted, skipping `undefined`, so the same data always gives the same text no matter what order its keys come in.
- **The modified mark lives inside the sealed data** (`modified?: true` on `GameSaveV3`). Without this, the next game write would put a fresh, valid seal over the edited data and wash the edit clean. Because the mark is sealed too, removing it breaks the seal again.
- **Checking on load:**

| Stored record | Result |
| --- | --- |
| Seal matches | Normal |
| Seal present but doesn't match | Load the data, set `modified: true`, and seal it on the next write |
| No seal (saves from before this release) | Accept as normal and seal on the next write. `// shortcut: unsealed saves are trusted for the upgrade window; in the first release after 2027-03-01 treat a missing seal as modified.` |

Until that cutoff, someone can delete the `seal` field to get past the check. That's the accepted cost of not flagging every existing player on upgrade. After the cutoff, deleting it counts as tampering.

### Changes

| File | Change |
| --- | --- |
| `src/storage/saveSeal.ts` (new) | `canonicalJson(value)`, `sealOf(value): string`, `sealMatches(value, seal): boolean`, and a private `SEAL_KEY` constant. `sealOf` ignores the `seal` field when it's present. |
| `src/storage/gameSave.ts` | Add `readonly modified?: true` to `GameSaveV3`. `normalizeV2` copies it (`value.modified === true ? { modified: true } : {}`), because it rebuilds the object field by field and would otherwise drop it. It drops `seal` automatically for the same reason, which is what we want. `cloneGameSave` already spreads, so it keeps `modified`. |
| `src/storage/gameStore.ts` | `ensureLoaded`: read the raw value, work out whether the seal is valid, missing or broken (checking the raw value before migration), then `migrateGameSave`. On a broken seal, add `modified: true`. `enqueue`: `persistence.write({ ...next, seal: sealOf(next) })`. The in-memory snapshot stays seal-free. Keep the existing catch that falls back to a default save on read errors. |
| `src/storage/persistence.ts` | No change. It already stores whatever object it's given. |
| `src/ui/career.ts` | When `save.modified`, show one short note under the career totals: "Records on this device were changed outside the game." It's text only, needs no action, and screen readers read it as normal text. |
| Future leaderboard | Must refuse to submit from a `modified` save. |

### Tests

- `tests/storage/saveSeal.test.ts` (new):
  - The same data with different key order gives the same seal.
  - Changing any one score, total or rank changes the seal.
  - A `seal` field inside the value doesn't affect the result.
- `tests/storage/gameStore.test.ts` (add, using `MemorySavePersistence`):
  1. A recorded shift writes a `seal`, and reloading gives `modified` undefined.
  2. Raise a best score in the stored value without updating the seal, then reload: the score is kept and `modified === true`.
  3. **No washing:** after test 2, record another shift and reload. `modified` is still `true` and the new seal matches.
  4. **Legacy save:** a stored save without `seal` loads with `modified` undefined, and the next write adds a seal.
  5. Removing `modified` from a sealed modified save breaks the seal, so the save is flagged again.
- All existing storage tests still pass without changes.

---

## 4. Resume a shift after the app closes

### Behaviour

- Whenever a shift is paused (Pause button, Escape, app sent to the background, page hidden), it's saved on the device.
- On the next launch, if a saved shift exists for an unlocked map, the start panel shows a **Resume shift** button with context, e.g. "Carrier Coast · Hard · 14 landed".
- Resume rebuilds the field at the shift's original world size, puts every aircraft, route, hold, score and timer back, and opens the existing **Pause** panel. The player taps Resume as usual.
- Starting a new shift, choosing another map from the pause panel, or reaching game over deletes the saved shift.
- A resumed shift finishes through the normal game-over path with its original `runId`, so records, promotions and achievements count once.

### Storage

Use `localStorage` (key `vector-approach:active-shift`), not IndexedDB. It writes synchronously, so the save finishes inside `visibilitychange`/`pagehide` before Android or the browser kills the page. The data is small (a few KB of aircraft and route points). It stays separate from the career save, so a bad shift save can never damage career data.

```ts
interface ActiveShift {
  version: 1;
  savedAt: number;
  runId: string;
  mapId: MapId;
  difficulty: DifficultyId;
  orientation: ViewportProfile['id'];
  world: { width: number; height: number };
  twoEndLanding: boolean;
  simulation: SimulationState;
  tracker: { evidence: ShiftEvidence; warned: boolean };
}
```

### Changes

| File | Change |
| --- | --- |
| `src/core/Simulation.ts` | Export a `SimulationState` type covering `randomState`, `accumulator`, `nextSpawnAt`, `openingSpawnIndex`, `nextAircraftId`, `activeWarnings` (an array), `elapsed`, `score` and `aircraft`. Add `exportState()`, which returns a `structuredClone` of those fields, and `restore(state)`, which assigns them and sets the phase to `'paused'`. `SeededRandom` gets a `state` getter and accepts a raw state in its constructor. |
| `src/progression/achievements.ts` | Add `ShiftTracker.restore({ evidence, warned })`. Today `warned` is private and `evidence` is readonly, so this needs a small accessor for `warned` as well. |
| `src/storage/activeShift.ts` (new) | `saveActiveShift(shift, storage = globalThis.localStorage)`, `loadActiveShift(storage)` and `clearActiveShift(storage)`. Each is wrapped in try/catch, because storage can throw in private mode or when full. The save stores `{ ...shift, seal: sealOf(shift) }` using step 3's helper. `loadActiveShift` checks the boundary: the seal matches, `version === 1`, `isMapId(mapId)`, a known difficulty, finite positive world size, and `simulation.aircraft` is an array. Anything else gets cleared and returns `undefined`. A broken seal here just discards the shift, unlike the career save: losing one in-progress shift is harmless, and accepting an edited one would let someone fake a score. |
| `src/game/scenes/PlayScene.ts` | Add `exportShift()`, which returns `{ runId, simulation: simulation.exportState(), tracker }`. Add `restoreRun(shift): boolean`, which mirrors `startRun` but calls `simulation.restore()` instead of `start()`. It first checks that every `landingZoneId`, `approachZoneId` and `route.destinationZoneId` in the save exists in `this.layout.landingZones`, and returns `false` if one doesn't (the map changed in an update). It emits `run-state` `"paused"`. Aircraft views are created by the existing `syncAircraft` on the next frame. `// shortcut: planes taxiing on the ground are not restored; restore groundTraffic if players notice.` |
| `src/main.ts` | `createGame(profile, mapId, restore?: ActiveShift)` uses `restore.world` instead of `worldSizeForViewport(...)` and `restore.twoEndLanding` instead of the setting when one is given. `pauseRun()` calls `saveActiveShift(...)` after `scene.pauseRun()`, which covers the button, Escape and `visibilitychange`. Add a `pagehide` listener that pauses (and so saves) a running shift. `beginRun`, `handleGameOver` and the pause panel's choose-map button call `clearActiveShift()`. At boot, `loadActiveShift()` shows the **Resume shift** button when the map is unlocked. Its click sets `activeMapId`, `activeDifficulty` and `activeProfile` from the save, rebuilds with `restore`, and on `scene-ready` calls `scene.restoreRun()`. It then reuses `pauseRun`'s panel setup, applies the session speed, and sets `activeRunId = shift.runId`. If restoring fails, clear the save and `announce("Saved shift could not be restored")`. |
| `index.html` | Add a hidden `#resume-shift-button` and a context line in `#start-panel`. |
| `public/privacy.html` | No change. The data stays on the device, like the career save. |

The existing resize-preserving work already keeps the world size fixed and fits it into any screen. A shift saved in portrait and resumed in landscape fits the same way. If the field is too small, the existing `fieldPlayable()` check keeps Resume disabled with its notice.

### Tests

- `tests/core/Simulation.test.ts`, **round trip is exact:** run simulation A for 30 s with routes and a hold. Run simulation B for 15 s, put `exportState()` through `JSON.stringify` and `parse`, restore it into a new `Simulation`, resume, and run another 15 s. Snapshots A and B must be equal (score, elapsed, aircraft positions and ids).
- `tests/storage/activeShift.test.ts` (new, with an in-memory `Storage` stub): a save loads back the same. A wrong version, unknown map, malformed JSON, a missing `aircraft` array, or an edited score with a stale seal each return `undefined` and clear the key.
- Browser: start a shift, route two planes, hold a third, reload the page, then Resume shift. Check the same planes, routes, hold ring and score, then play on to game over and check the shift is recorded once and the Resume button is gone. Repeat on the Android build by swiping the app away from recents.

---

## Order and size

| Step | Main files | Rough size |
| --- | --- | --- |
| 1. Speed | PlayScene, main.ts, index.html | about 40 lines |
| 2. Hold / go-around | Simulation, types, PlayScene, help copy, 4 tests | about 80 lines |
| 3. Save seal | new `saveSeal.ts`, gameSave, gameStore, career note, 2 test files | about 70 lines |
| 4. Resume shift | Simulation, ShiftTracker, new `activeShift.ts`, PlayScene, main.ts, index.html, 2 test files | about 250 lines |

Run `npm test` and `npm run build` after each step. Run `npm run test:resize` after step 4, because it touches `createGame` and pause.

## Risks

- **Records at ½× speed.** The traffic is the same, but players get more reaction time. Local records ignore speed, which is fine offline. A future global leaderboard should store the speed with each score or accept only 1×.
- **Saved shift from an older build.** The zone-id check catches renamed runways. A change to physics constants would replay slightly differently, which is acceptable for a casual resume.
- **Hold near another plane.** A hold doesn't avoid traffic. Collisions still end the shift on purpose.
- **The seal is a deterrent.** The key ships with the game, so a determined person can still fake a sealed save. Before the 2027-03-01 cutoff, deleting the seal also gets past the check. Don't treat a sealed save as proof for anything other players see.
- **False "modified" flags.** A bug in `canonicalJson`, or a schema change that rewrites stored data without resealing, would flag honest players. Tests 1–5 cover the normal write path. Any future migration must write through `enqueue` so the save is resealed.
