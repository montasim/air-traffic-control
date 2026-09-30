# Current behavior correction — normal landing at both ends

Implemented: runway capture now uses proximity (including swept movement) regardless of heading or side of entry. Reaching the selected matching target is sufficient. The aircraft must reach the target; drawing a line there does not land it immediately. Shared runway reservations and busy warnings remain; nearby aircraft can reserve a runway from any angle. Alignment warnings and angle requirements in practice, help, and onboarding were removed.

Regression coverage compares sideways and aligned arrivals at all four Saltmarsh targets. The historical plan below is retained as context; its angle and outside-entry requirements are superseded by this correction.

Verification: all 375 unit tests and the production build passed. On localhost:5173 at 1909×929, direct pointer-drawn routes completed touchdown and scoring at commuter ends 13/31 and liner ends 08/26 (Easy, no resize). No alignment waypoint was added to these routes.

---

# Land from either end of a runway

Date: 2026-09-30

Status: implemented on 2026-09-30 following the user's explicit implementation request.

## Implementation record

All nine playable airfields now expose two approach targets for each runway. Each end has its own designation, inward heading, route destination, and guidance. Helicopter pads retain proximity capture. Aircraft must approach runway targets aligned within 30 degrees and from the outside half of the threshold; swept capture checks handle movement between simulation steps.

A deterministic, simulation-owned reservation covers both runway ends. Acquisition occurs on aligned final approach within two capture radii; equal-distance contenders use aircraft ID (with a numerical tolerance for floating-point ties). Ownership survives pause/resize and landing, then releases on completion, rerouting away, departure, removal, game end, or restart. Busy and misaligned aircraft continue flying with visible warning rings and status messages; busy approach labels are marked while drawing. Warnings begin within four capture radii. Scoring remains once per aircraft, and approach warnings count as warnings for the existing Steady Hands achievement.

The route UI displays both compatible ends, emphasizes the selected end, and includes runway designations in announcements. Endpoint acquisition takes precedence over an end merely crossed by the drawing segment. Assigned end identity persists after route points are consumed, preventing accidental capture by the other end. Help, onboarding, the practice flight (including reverse approaches), and README instructions are updated. Resize controls still say **Resume**.

Implementation choices relative to the original sequence:

- Paired approach generation happens once in the shared `defineMap().prepare()` boundary using runway metadata from guidance surfaces. This covers all nine maps and their previews without duplicating reciprocal geometry in each authored layout.
- Original runway `zoneId` and raw layout factories remain compatible as authored geometry inputs. Prepared gameplay layouts carry the end-to-runway association. Legacy standalone Saltmarsh geometry is retained; it is not a selectable gameplay map. No career-save migration is needed.
- A small optional `approach` record distinguishes runway-end targets from pads/legacy targets, preserving existing public fixture and layout compatibility rather than forcing an unrelated type migration.
- Twin Banks’ square-layout main runway moves slightly left and down so its threshold capture circle clears the best-score HUD exclusion. All prepared runway-end capture circles are checked against HUD exclusions.
- Existing arrow/funnel rendering is reused with each end's inward angle, supplemented by compatible-end circles, arrows, labels, and busy state. No runway artwork is duplicated.

Verification:

- `npm test`: 31 files, **371 tests passed**. New coverage includes all nine maps at four world shapes, reciprocal geometry and in-bounds final approaches, successful landings at every fixed-wing end, angle wraparound, swept/sideways/wrong-side capture, exact destination retention, pointer-end precedence, opposing and same-direction reservation conflicts, independent runways, release/reset, pause continuity, and exactly-once scoring/evidence.
- `npm run build`: passed TypeScript and production/PWA build.
- `npm run build:desktop` and `npm run test:desktop`: passed, including orientation resize/resume.
- `npm run test:resize`: passed actual route drawing, post-fit input alignment, partial-stroke cancellation, pause safeguards, and shift continuity.
- `npm run test:resize:maps`: all 18 map/orientation checks passed.
- `npm run test:runway-ends`: browser regression uses real pointer-drawn routes for commuter and liner approaches in both directions. It also checks preservation of runway ownership through resizing, and verifies scoring evidence. Other opening traffic is routed safely so unrelated game-over conditions cannot truncate the tested landing. Screenshots are written to `test-results/runway-ends/`.
- Visual review confirmed both end labels and inward arrows, selected-end emphasis, and the drawn reciprocal approach on the live renderer.

Browser scripts use a disposable Chrome profile and the development server on port 4287 (`RESIZE_TEST_URL` overrides the address). `test:runway-ends` uses deterministic Easy traffic and controlled browser time; simulation tests cover the landing rules independently of difficulty. Physical touch/pen devices and screen-reader speech were not manually certified. Opposing-arrival arbitration is verified in deterministic simulation tests; no claim is made that two opposing live flights were manually piloted in the browser.

The specification below is retained as design history.

## Intended experience

Each runway accepts its supported aircraft type from either end. The player draws toward the desired end; guidance identifies that end and its inward landing direction. Aircraft must arrive aligned with that direction. Helipads retain their existing behavior.

Use two approach targets for one physical runway. Do not duplicate runway artwork or treat the ends as independent runways. Preserve aircraft classes, difficulty selection, existing scoring, and the resize/resume behavior.

Example: River Bend's main runway offers approaches 07 and 25. Selecting 25 highlights that end and reverses the approach arrow. A flight assigned to 25 must not be captured by 07 while passing nearby.

## Verified starting point

- `src/core/types.ts`: a `LandingZone` has a position, angle, accepted aircraft type, and capture radius. Routes already carry an optional `destinationZoneId`.
- `src/core/landingTargeting.ts`: drawing acquires nearby compatible zones with retention hysteresis. It considers both the pointer endpoint and its latest segment.
- `src/core/Simulation.ts`: `detectLanding()` currently accepts any compatible zone within capture radius. It does not enforce approach heading or the assigned destination. Landing animation turns toward the zone angle after capture.
- Landing aircraft are excluded from the current airborne separation checks. Simply adding opposite targets would therefore allow conflicting landings to disappear into the landing animation.
- `src/game/maps/shared/airfield.ts`: `MapRunway` already has a physical ID, geometry, and a pair of end designators, but only one `zoneId`.
- `src/game/maps/shared/guidance.ts`: runway guidance currently maps one zone to each runway surface.
- Map layouts construct their own landing targets. The nine playable maps, including the five specialist layouts using shared construction, must all migrate.

Correction to the earlier discussion: heading alignment is a new rule in this implementation, not a constraint already enforced by the simulation.

## Gameplay decisions

### Target selection and valid landing

1. Both runway ends remain available as route destinations for compatible aircraft.
2. A committed destination selects an exact end. Re-routing may change it until landing starts.
3. For a targeted route, test capture only against its selected end. For a route without a destination, retain automatic landing only when a compatible end passes the same heading and approach-side checks.
4. Require an inward approach: heading within an initial 30-degree tolerance of the end's approach angle, and entry into the capture region from the outside half of the runway threshold. Use previous/current aircraft positions to detect crossing, rather than requiring the aircraft to remain outside the threshold after it moves.
5. A wrong-way, sideways, or incompatible pass continues flying. Show brief actionable guidance when relevant; do not teleport, reverse, or silently switch the aircraft's destination.
6. Preserve the current landing duration and scoring initially. A longer rollout is a separate visual change, not required to add the second approach.

The 30-degree tolerance is a tuning value to verify with actual aircraft turn rates, especially on Hard. Keep it named and tested, not scattered across maps.

### Opposing traffic: one aircraft reserves a runway on final approach

Use a short final-approach reservation shared by both ends. Drawing or committing a distant route must not reserve the runway.

- A compatible aircraft can acquire the reservation when it is aligned within the same heading tolerance and inside an approach corridor extending two capture radii outward from the selected end, with half-width equal to that end's capture radius. For untargeted flights, use the eligible end under the same rules.
- The reservation belongs to one aircraft and one physical runway. It blocks any other aircraft from starting a landing on either end, including same-direction traffic during that short occupancy period.
- Resolve simultaneous acquisition deterministically: closest remaining distance to the threshold first, then aircraft ID. Gather candidates before updating ownership so array iteration order does not decide the result.
- Keep the reservation through landing; release it on completion, departure from the final corridor before touchdown, a route change away from that runway end, aircraft removal, game end, or a new shift. Pause freezes ownership; resizing preserves it.
- A blocked aircraft continues its route and remains subject to airborne collision and airspace-exit rules. There is no automatic holding, braking, or go-around. Show “Runway busy — reroute aircraft” as it approaches the occupied corridor, with a visible aircraft warning.
- Keep both end targets selectable so players can plan ahead. Availability is advisory until the aircraft actually reaches final approach, and route confirmation must not promise a landing clearance.

This adds a small runway occupancy rule, not a taxiway or airport scheduling system. Validate that players have enough time to reroute; if the corridor is too short, tune it together with the warning distance before shipping.

## Implementation sequence

### 1. Represent ends and physical runway identity

Update `src/core/types.ts` and `src/game/maps/shared/airfield.ts`:

- Distinguish runway-end targets from pads explicitly, preferably with a discriminated union. Runway-end targets carry `runwayId` and an end identity; pads have no runway reservation.
- Replace the single runway `zoneId` relationship with an explicit ordered pair of approach-zone IDs matching the existing negative/positive end designators.
- Preserve the existing zone ID for the existing approach where possible; introduce a deterministic ID for the opposite end. Physical IDs must be unique within a map, including maps with multiple airports.
- Keep route destinations and landing events keyed by approach-zone ID. Key reservations by physical runway ID. Score and achievement evidence remain aircraft-based, so one aircraft still produces one landed event.
- No career-save migration is needed: the existing career save does not store active routes or runway reservations. Verify this remains true at implementation time.

### 2. Generate paired approaches for every playable layout

Add one shared construction helper using existing runway geometry and authored touchdown offset:

- Preserve the original approach position and capture radius.
- Mirror its along-runway offset around the runway center for the reciprocal approach, with inward heading differing by pi radians, normalized consistently.
- Map negative/positive threshold labels to the existing authored designators; do not derive real runway numbers from the game's screen coordinate angles.
- Validate non-overlapping capture regions, in-bounds target positions, usable outside approach corridors, separation from other destinations, and HUD exclusions. Adjust individual map geometry only where evidence shows insufficient approach space.

Apply to Saltmarsh Gateway, River Bend, Desert Parallel, Twin Banks, and the shared specialist-airfield builder used by Falcon Air Base, Executive Point, Metro International, Freight Junction, and Island Rescue. Inspect legacy Saltmarsh layouts and tests as well; migrate or explicitly retain their compatibility rather than leaving type errors or stale assumptions.

### 3. Make selection and guidance end-specific

Update `landingTargeting.ts`, shared guidance surfaces, `guidanceGeometry.ts`, `RouteGuidanceRenderer.ts`, and the relevant `PlayScene.ts` call sites:

- Resolve a guidance entry for each approach end while drawing the physical runway only once.
- Show subtle compatible markers for both ends; emphasize only the acquired end with inward arrows, its designation, and the aircraft category.
- Prefer the pointer endpoint's eligible end over a target merely crossed by a long pointer segment. Keep hysteresis without trapping selection on the old end when the pointer clearly reaches the other one.
- Reflect the actual simulation alignment tolerance in approach guidance. A snapped endpoint alone is not proof of a valid landing angle; preserve the drawn route and explain misalignment rather than inserting sharp automatic turns.
- Include the selected end in route confirmations, invalid-approach feedback, and accessible status text. Add runway-busy feedback without announcing it on every frame.
- Use current screen-space touch selection behavior and verify both targets remain distinguishable on small fitted canvases.

### 4. Enforce approach validity and occupancy in the simulation

Refactor `Simulation.detectLanding()` into a small eligibility check and capture transition. Add reservation state owned by `Simulation`, with deterministic acquisition before landing capture during each fixed step.

Use swept entry checks for capture/corridor boundaries where needed so a fast aircraft does not skip the threshold between updates. Explicitly handle an aircraft already inside a region to avoid getting stuck or bypassing the approach-side rule. Keep pad capture behavior unchanged.

Publish only the runway availability information needed by presentation through snapshots/events. Do not let the renderer grant or release reservations. Route rejection and advisory warnings must remain distinct: a future route may be valid even while a runway is temporarily occupied.

Review interaction with `advanceLanding()`, route exhaustion, re-routing, aircraft removal, and game-over events. Maintain exactly one landing-started event and one score increment per successful landing. Preserve pause/resume state and existing collision behavior outside runway occupancy.

### 5. Explain and tune the behavior

Update How to play, the route coach, practice content where applicable, and project documentation to explain selecting either end, following the approach direction, and rerouting around a busy runway.

Retain the UI label “Resume.” Do not change difficulty traffic profiles or erase existing records in this feature. Assess difficulty after both ends work; any later rebalance should be an explicit separate change.

## Verification and acceptance

### Automated checks

- Map contracts: exactly two approaches per physical runway; distinct IDs; equal accepted class; mirrored offsets; reciprocal headings; correct designators; unchanged pad counts; corridor and HUD clearance across portrait, square, landscape, and expanded initial-world sizes.
- Targeting: acquire each end, switch ends deliberately, retain stable selection near boundaries, reject wrong classes, and handle mouse/coarse input and long pointer segments.
- Simulation: land successfully at both ends, enforce assigned end, reject wrong-side/sideways passes, handle angle wraparound and capture boundaries, preserve pad behavior, and prevent duplicate scoring.
- Reservation: simultaneous opposing and same-direction arrivals; deterministic tie-breaking; independent runways; release on completion/re-route/departure/reset; no stale owner; blocked aircraft remain flying; paused time does not alter ownership.
- Progression: either direction contributes one landing with the original aircraft type; existing records and achievement evidence remain valid.
- Resize regression: a routed aircraft's end choice and runway reservation survive resize, pause, and Resume without rebuilding the world.

### Browser checks

- Complete real landings from both ends for each supported fixed-wing class. Verify the highlighted end, drawn route, and capture direction agree.
- Exercise opposing final approaches and same-direction occupancy. Confirm the warning arrives early enough to reroute, and that a busy aircraft is not silently counted as landed.
- Inspect all nine maps in both starting orientations; include close parallel runways, mixed runway/pad maps, and opposite thresholds near screen edges.
- Test small-screen selection, keyboard-accessible help/status, mouse and touch where available, and the existing minimum fitted-field pause safeguard.
- Run `npm test`, `npm run build`, resize browser regressions, and the desktop smoke test where available. Record exactly which physical-device checks were completed.

## Completion gate

Mark this plan implemented only after all nine playable maps support both ends, actual approach direction is enforced, occupancy has no stale reservations, guidance identifies the intended end, scoring occurs once, and the required automated and available browser checks pass. Record tuning values, test evidence, and any unverified physical-device coverage.

Do not describe the feature as complete if only a second marker has been added or if opposing runway arrivals can both enter landing animation. Preserve the fixed-world resize/resume implementation throughout.
