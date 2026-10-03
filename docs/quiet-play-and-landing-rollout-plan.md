# Quiet play, landing rollout, and celebratory results

Date: 2026-10-03

Status: implemented on 2026-10-03. The open questions were answered the same
day: parked aircraft fade after a few seconds, a second aircraft waits behind
the first on the taxiway, and the rollout has no sound of its own.

## Implementation record

- **Quiet play.**
  - The landing message is gone. Screen readers still hear every landing.
  - `RunwayTraffic`, `approach-warning`, the reservation snapshot fields, the
    "! Runway busy" labels, and the "· BUSY" tag are removed;
    `runwayApproach.ts` keeps only `crossesCapture()`.
  - The help text and README are updated.
  - Five reservation tests became two: opposite-end landings on one runway
    both score, and a follower lands right behind its leader.
    `test-runway-ends.mjs` now checks the destination survives a resize on
    final approach, and passes at all four runway ends.
  - The home record line reads "Best · NN landings"; the difficulty buttons
    already show the difficulty.
- **Celebratory results.**
  - `src/ui/shiftCelebration.ts` renders achievement badges (icon, name,
    description) that pop in 90 ms apart.
  - A promotion card (rank badge plus unlocked-airfield chips) is timed to the
    promotion sound.
  - "New best" is a pill inside the Best card, so the Score and Best cards
    stay the same size.
  - The achievement icons moved to `src/ui/achievementIcons.ts`, shared with
    the career page. Reduced motion shows everything at once.
- **Landing rollout.**
  - `src/game/maps/shared/groundRoutes.ts` builds a route for every runway
    end inside `defineMap()`, from each map's existing runways, taxiways, and
    stands. Routes stop before buildings, using the same placement rule the
    painter uses: `buildingCenterClearOfRunways()` moved to `geometry.ts`.
    Stands are used only when reachable without crossing a runway or
    building; otherwise the aircraft parks at the route end.
    `tests/game/groundRoutes.test.ts` checks all 9 maps × 4 shapes × both
    modes.
  - `src/game/ground/groundTraffic.ts` drives the decelerating rollout, taxi,
    in-place pivots for back-taxi, queueing (measured along the path on a
    shared route), the 4 s rest, the 600 ms fade, early eviction when the
    apron is full, helicopter settle, and reduced motion. It is covered by
    `tests/game/groundTraffic.test.ts`.
  - `PlayScene` hands a landed aircraft's own view to the ground layer when
    it leaves the simulation, so taxiing never affects collisions or scoring.
    It advances only while the shift is running.
- **Landed look** (requested during review).
  - Touchdown settles to 50% of flight size (first 70%, reduced after device review).
  - Landed aircraft blend to muted colours (`LANDED_AIRCRAFT_TOKENS`) over
    400 ms, so the eye stays on airborne traffic.
  - A stand marks a line, not a nose direction, so aircraft park along it
    facing the way they arrived instead of spinning around.
- **Known limit.** Desert Parallel's C runway has FIELD OPS pushed against it,
  so that route stops at the runway edge and the aircraft fades there.
- **Verification.**
  - 499 tests pass; web, desktop, and Android builds pass.
  - Real-game Playwright captures at 1280×800 and 412×915 show rollout, taxi,
    parking, and fading with no page errors.

## Goal

1. **Quiet play.** During a shift the only on-screen message is "Route not
   added", because it explains a failed input. Landings no longer show
   "+1 · Safely landed", and the runway-busy rule and its warnings are
   removed. Screen-reader announcements stay.
2. **Landing rollout.** A landed aircraft no longer shrinks and vanishes. It
   rolls out along the runway, turns onto the connecting taxiway, and parks at
   a stand or hangar.
3. **Celebratory results.** Achievements and promotions stay on the
   game-over screen, shown as animated badges with icons instead of one line
   of text.

All three changes are in the shared web code. Android and desktop get them
through their normal builds (`npm run android:sync`, a new APK, or a
desktop package). No platform-specific work is needed.

## Decisions

| Topic | Decision |
| --- | --- |
| Runway reservation | Removed. Reaching the matching runway end always lands. |
| Taxiing aircraft | Visual only. They cannot collide, cannot be selected, and never block a runway or a landing. |
| Score timing | Unchanged: +1 at touchdown. The rollout is a reward to watch, not a requirement. |
| Parked aircraft | Rest at their stand for 4 s, then fade out over 600 ms. If every stand is taken before then, the oldest parked aircraft fades early to make room. |
| Taxiway traffic | A following aircraft waits behind the one ahead on the same taxiway and moves on once the gap reopens. |
| Sound | None for the rollout or taxi. The existing landing sound at touchdown is the only cue. |
| Helicopters | No taxi. They settle on the pad, the rotor spins down, then they fade out. |
| Steady Hands achievement | Counts only proximity warnings (red rings), because busy warnings no longer exist. Slightly easier than before. |
| Reduced motion | No rollout. The aircraft fades out at the touchdown point without shrinking. |

## Part 1: Quiet play

### 1a. Remove the landing message

- `src/main.ts` `announce()`: stop calling `showFlightMessage` for
  "Aircraft landed". The hidden `#route-status` live region still reads
  "Aircraft landed. Score N." for screen readers.
- Landing feedback is then the touchdown and rollout animation, the score
  pulse, and the landing sound.
- `#flight-message` now only ever shows "Route not added…". Its phone
  placement at the bottom stays as is.

### 1b. Remove runway reservations and busy warnings

Today a plane near a runway end reserves the whole runway (both ends) for
the approach and the 0.72 s landing. Any other plane reaching that runway
flies through without landing and shows "! Runway busy"
(`src/core/runwayApproach.ts`). That is a hidden rule with a harsh penalty: an
unexpected overflight can end the shift. It existed only so opposite-end
landings could not overlap during the landing animation.

- `src/core/runwayApproach.ts`: delete `RunwayTraffic`, `RunwayReservation`,
  and `ApproachWarning`. Keep `crossesCapture()`; drop `onFinal()` if nothing
  else uses it.
- `src/core/Simulation.ts`:
  - remove `runwayTraffic`, its `update` and `release` calls, and
    `approachWarningKeys`
  - remove `approach-warning` events and the snapshot fields
    `runwayReservations` and `approachWarnings`
  - in `detectLanding()`, drop the owner check. Capture plus a matching
    destination is enough.
- `src/core/types.ts`: remove the `approach-warning` event and the two
  snapshot fields. Snapshots are only kept in memory for resize and rebuild,
  never saved, so no save migration is needed.
- `src/game/scenes/PlayScene.ts`: remove the `approachWarningLabels` drawing
  (`! Runway busy`), the `· BUSY` suffix on approach labels, and the
  `approach-warning` event branch that shows "Runway busy — reroute aircraft".
- `src/progression/achievements.ts`: the shift tracker no longer listens for
  `approach-warning`.
- Copy:
  - `index.html` help step 3: remove "Amber labels identify a busy runway."
  - `README.md` lines 51–53: remove the reservation paragraph.
- Tests:
  - `tests/core/bidirectionalLanding.test.ts` (13 reservation references):
    replace the reservation cases with "two aircraft land on the same runway
    from opposite ends, each scores once".
  - Update the one reference in `tests/core/Simulation.test.ts`.
  - `scripts/test-runway-ends.mjs`: drop the ownership-across-resize
    assertions (lines 80–104) but keep the landing and scoring checks.

## Part 2: Landing rollout animation

### Approach: the simulation ends at touchdown; the rollout is presentation

The simulation keeps its current, tested contract: capture, a short landing,
then the `landed` event, after which the aircraft leaves the simulation. On
`landed`, the scene hands the aircraft to a new presentation-only **ground
traffic** layer that animates it along a ground route. This keeps gameplay
deterministic and leaves collision and scoring logic untouched. It also
means taxiing aircraft can never cause a game over.

### Ground route data

Taxiway and stand geometry already exists, but it is private to each map's
layout:

| Maps | Source data |
| --- | --- |
| Saltmarsh Gateway, River Bend, Desert Parallel, Twin Banks | Shared `AirfieldLayout`: `runways` (centre, length, angle, zone), `taxiways` (path plus `connects: [runwayId, apron]`), `parkingStands` (position and angle), hangar `propAnchors`. |
| Metro International, Freight Junction, Falcon Air Base, Executive Point, Island Rescue | `SpecialistLayout`: `runways`, one taxiway per runway (runway centre → terminal), `apron` polygon, `buildings` (terminal, cargo hangars). No stands. |

Add one optional field to the gameplay seam (`PlayableMapLayout`):

```ts
readonly groundRoutes?: Readonly<Record<string, GroundRoute>>; // keyed by landing zone id
interface GroundRoute { readonly points: readonly Vector2[]; readonly stands: readonly Stand[] }
```

A shared pure helper, `createGroundRoutes(runways, taxiways, stands, zones)`
in `src/game/maps/shared/groundRoutes.ts`, builds one route per fixed-wing
landing zone. Both maps' `prepare()` call it, so it covers every viewport and
both landing-end modes.

1. **Rollout.** Start at the touchdown point (the zone position) and follow
   the runway axis in the landing direction (`zone.angle`) to the junction of
   the runway's taxiway.
   - If that junction is behind the touchdown point (possible when landing
     at the opposite end), roll to near the far end, turn 180°, and taxi
     back to the junction.
2. **Turn-off.** Join the runway axis to the taxiway with a short curve, not
   a sharp corner.
3. **Taxi.** Follow the taxiway path to the apron.
4. **Stand.** Specialist maps have no stands, so derive three along the apron
   edge facing the terminal or hangar. The parking spot and heading are
   assigned at runtime.

A zone with no route (helipads, or a map without taxiway data) falls back to
the settle-and-fade behaviour.

### Motion

- Speeds scale with the map unit `u = min(width, height)`, so the animation
  looks the same at every viewport size.
- **Touchdown.** Replace today's shrink-to-25% with a subtle settle: scale
  from flight size to about 0.85 (as if descending onto the ground) and the
  shadow tucks in. No fading.
- **Rollout.** Ease out from the approach speed to taxi speed over about
  1.2–1.6 s.
- **Taxi.** Constant slow speed. Heading follows the path tangent, with
  smoothed turns. Total taxi time is about 3–5 s, depending on the map.
- **Park.** A final turn to the stand heading, then the aircraft stops.
- **Following traffic.** Aircraft that share a route segment keep a minimum
  gap of about two aircraft lengths. A follower that would close the gap
  slows to a stop behind the leader and moves on once the gap reopens, so it
  waits on the taxiway rather than overlapping. Rollouts on the runway
  follow the same rule. With the reservation removed, two aircraft can land
  on one runway close together, and the second slows behind the first.
- **Depth.** Below airborne aircraft, route lines, and guidance; above the
  airfield art.
- **Interaction.** Not interactive. Pointer input ignores ground traffic.

### Lifecycle and edge cases

- **Stands.** Assign the nearest free stand. A parked aircraft rests for 4 s,
  fades out over 600 ms, and frees its stand. If an arriving aircraft finds
  every stand taken, the oldest parked aircraft starts its fade early.
- **Pause.** Ground traffic advances only while the shift is running, so it
  freezes during pause, dialogs, and resize settling.
- **Resize or rebuild.** A layout rebuild clears ground traffic: positions
  are in old map coordinates, and the effect is cosmetic.
- **Game over and restart.** Ground traffic freezes on game over and clears
  on restart and new shifts.
- **HUD.** Routes and stands must avoid `hudExclusionZones` so parked
  aircraft never sit under the score or pause controls (checked by test).
- **Performance.** At most stands + 3 ground aircraft per map, each a reused
  `AircraftView` and one tween-free update per frame.

### Code

- `src/game/maps/shared/groundRoutes.ts`: pure route geometry (new).
- `src/game/ground/GroundTraffic.ts`: moves views along routes by arc length
  with the speed profile, handles queueing and stand assignment (new).
- `src/game/rendering/AircraftView.ts`: the settle replaces the shrink and
  fade; add a ground mode with no selection rings.
- `src/game/scenes/PlayScene.ts`: on `landed`, hand the aircraft's view to
  `GroundTraffic` instead of destroying it; drive it from `update()`; clear
  it on rebuild and restart.
- Map `prepare()` functions: attach `groundRoutes`.

### Tests

- **Contract test across all maps.** For every map × four viewport shapes ×
  both landing modes, every fixed-wing landing zone has a ground route that:
  - starts at the touchdown point
  - stays inside the world bounds
  - ends at a stand
  - avoids the HUD exclusion zones
- **Geometry unit tests.** Rollout direction for both runway ends, the
  back-taxi case, curve continuity (no heading jump above a threshold), and
  stand assignment and eviction order.
- **Ground traffic unit tests.** Pure state, no Phaser:
  - a follower stops at the minimum gap behind a leader and resumes once the
    leader moves on
  - a parked aircraft fades after 4 s and frees its stand
  - a full apron evicts the oldest parked aircraft first
- **Simulation tests.** `landed` still fires once per aircraft and scoring is
  unchanged.
- **Manual check.** Every airfield in portrait and landscape, on desktop and
  phone, with reduced motion on and off.

## Part 3: Celebratory game-over screen

Today `#achievement-result` is one line of text ("Achievements earned: First
Landing · Busy Shift"), and a promotion is a sentence in `#career-result`.

- **Achievement badges.** Render each new achievement as a badge with its
  icon, name, and one-line description.
  - Use a list (`<ul>`) for screen readers.
  - Move the icon map out of `src/ui/career.ts` (a local `icons` record) into
    a shared module, so the career page and the result screen use the same
    icons.
- **Animation.** Badges pop in one after another: fade plus scale from 0.85,
  about 260 ms each, 90 ms apart, starting once the result card is visible.
  The earned icon gets a short accent pulse.
- **Promotion.** A dedicated block with the rank badge, "Promoted to
  {rank}", and chips for newly unlocked airfields. Its entrance is timed to
  the existing promotion sound (already delayed 940 ms after a collision).
- **Personal best.** "New personal best!" becomes a small highlighted badge
  next to the Best card instead of a separate text line.
- **Phone.** Badges stack in one column within the scrollable result body.
  The buttons stay in their fixed footer.
- **Reduced motion.** Everything appears at once, with no pop-in or pulse.
- **Accessibility.** The existing announcements ("Achievements earned: …",
  "Promoted to …") stay unchanged.

## Order of work

1. **Quiet play (part 1).** Small and self-contained; it simplifies the code
   the animation then touches.
2. **Celebratory results (part 3).** UI only, independent of gameplay.
3. **Landing rollout (part 2), in three steps:**
   1. Ground route data and the contract test across all nine maps.
   2. Touchdown settle, rollout, taxi, parking, and the timed fade.
   3. Queueing behind the leader, early eviction, reduced motion, and final
      tuning per map.

Then rebuild the Android app (`npm run android:sync`, new APK) and test on
a phone.

## Resolved questions

1. **Parked aircraft:** fade a few seconds after parking (4 s rest, 600 ms
   fade).
2. **Close landings on one runway:** the second aircraft waits behind the
   first on the taxiway.
3. **Rollout sound:** none; the existing touchdown sound is the only cue.
