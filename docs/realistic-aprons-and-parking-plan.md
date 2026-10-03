# Realistic aprons, taxiways, and typed parking

Date: 2026-10-03

Status: implemented. See "Implementation record" at the end for how the build differs from the plan.

## Goal

1. **Aprons look like real parking areas.** On all nine maps the apron uses the
   same paving language as the runways (asphalt, light edge line, joints)
   instead of a flat grey shape.
2. **Taxiways look like real taxiways.** They use the same paving with a
   centre guide line, edge markings, a hold-short bar at the runway, and
   smooth curved joins. Landed aircraft follow the painted centre line exactly.
3. **Separate parking for each aircraft type.** Each apron has marked stands
   grouped by type (liner and commuter), with lead-in lines, stop bars, and
   L / C labels in each type's colour, and a clear divider between the
   groups. Each aircraft taxis only to a stand of its own type.
4. **The apron is never empty.** There is always one parked aircraft of each
   type, so players can see where landed aircraft go.

These are shared web changes; Android and desktop get them through their
normal builds.

## Decisions

Recommended defaults for the questions still open; confirm or change them.

| Topic | Decision |
| --- | --- |
| Who keeps the apron occupied | Each shift starts with one parked aircraft per type. The latest landed aircraft of a type parks at a free stand of that type, and once it stops, the previous parked aircraft of that type fades out (600 ms). So exactly one of each type is shown, and it always reflects your latest landing. |
| Parked look | Small (`GROUND_SCALE` 0.5) and muted landed colours, so they never compete with airborne traffic. |
| Helicopters | Unchanged: they settle on the pad and fade. Helipads keep their own markings. |
| Stands per type | 2 per type per apron, so the newcomer always has a free stand next to the one being replaced. Larger airports (Metro International, Freight Junction) get 3. |
| Moving scenery | Allowed where buildings or props block a sensible layout, mainly Desert Parallel's FIELD OPS (now pushed against the C runway) and the props in front of the specialist terminals. |
| Colour use | Stand markings use the aircraft colours at low intensity. DESIGN.md reserves these colours for aircraft and landing cues, and a type's parking spot is a landing destination cue. All other paving stays neutral. |

## Current state (research)

- **Shared painters.** `paintApron()` and `paintTaxiway()` in
  `src/game/rendering/shared-map/airfieldPainter.ts` paint all nine maps.
  - The apron is a flat polygon in two tones.
  - A taxiway is an asphalt line with an edge, with no centre line and with
    sharp corners. Its corners differ from the smoothed ground route, so
    taxiing aircraft drift off the painted line at bends.
- **Stands are painted per map.**
  - Desert Parallel and Twin Banks draw them in their own renderers.
  - Saltmarsh Gateway and River Bend draw them through the shared
    `AirfieldRenderer` path, which shows only one stand at mobile detail.
  - The five specialist maps have no stands. Painted props (shelters,
    containers, gates) occupy the space in front of their terminals.
- **Stands are untyped.** `ParkingStand` has no aircraft type, so any type
  can park anywhere.
- **Parked aircraft disappear.** `GroundTraffic` fades every parked aircraft
  after 4 s, and nothing is parked when a shift starts.

## Part 1: Data model

### 1a. Typed stands and taxilanes

In `src/game/maps/shared/airfield.ts`:

- `ParkingStand` gains `accepts: 'liner' | 'commuter'` and `entry: Vector2`.
  `entry` is the point on the apron taxilane where the stand's lead-in line
  starts.
- New `ApronTaxilane { id; path: Vector2[]; connects: [taxiwayId, ...standIds] }`
  is the guide line across the apron, from the taxiway's apron end past every
  stand entry.
- `AirfieldLayout` and `SpecialistLayout` gain `taxilanes`. Layouts that also
  define `parkingStands` must type every stand and give it an entry.

### 1b. One geometry for paint and motion

- Painted taxiways and taxilanes use the same rounded-corner geometry as the
  ground routes. Move `filletCorners()` from `groundRoutes.ts` into
  `shared-map/geometry.ts` and use it in both places.
- `createGroundRoutes()` then builds each route as follows:
  1. rollout along the runway (unchanged)
  2. the rounded taxiway centre line
  3. the taxilane, up to the chosen stand's `entry`
  4. the stand's lead-in line to its stop position
- A route therefore follows exactly what is painted. Routes become per stand
  rather than per zone, because the last two legs depend on the stand.
  `GroundRoute` becomes `{ points to the apron, rolloutLength, stands: GroundStand[] }`,
  where each stand carries its own `approach: Vector2[]` (taxilane plus
  lead-in).

## Part 2: Painting (shared, all maps)

New helpers in `airfieldPainter.ts` keep the current palette tokens
(`asphalt`, `asphaltEdge`, `apron`, `marking`, `taxiwayMarking`).

- **`paintApron` (rewritten)**
  - asphalt fill with the runway's edge treatment (a darker rim and a thin
    light edge line)
  - faint concrete joint lines on a grid aligned to the main runway (skipped
    at mobile detail)
  - a slightly lighter "stand zone" band behind each stand group
- **`paintTaxiway` (rewritten)**
  - rounded geometry
  - asphalt with edge lines
  - a continuous centre line in `taxiwayMarking`
  - a hold-short bar (two solid lines and two dashed) where it meets the
    runway, using the existing `holdShortMarkers` where a map has them, or
    otherwise generated at the runway edge
- **`paintTaxilane` (new):** the apron guide line in `taxiwayMarking`.
- **`paintStand` (new)**
  - a lead-in line from `entry`, curving into the stand's heading
  - a stop bar at the nose position
  - a small type label ("L" or "C") and stand number
  - the lead-in and label in the aircraft type's colour at reduced alpha
  - the stand footprint sized for that type at ground scale (liners larger)
- **`paintStandGroups` (new):** a painted divider line between the liner and
  commuter groups, plus a small group label ("LINERS" / "COMMUTERS") at
  desktop detail.
- **Detail levels.** At mobile detail the joints are dropped, but every stand,
  lead-in, and label stays. This replaces the old one-stand mobile limit.
- **Map renderers.** All nine use these helpers. Remove the per-map stand
  drawing in `desert-parallel/renderer.ts`, `twin-banks/renderer.ts`, and
  `AirfieldRenderer.ts`, and update `specialistAirfield.ts`.

## Part 3: Per-map layouts

Each map gets a taxilane and 2 typed stands per type per apron (3 at Metro
International and Freight Junction). Stands sit in rows facing their
terminal or hangar, spaced at least one liner length at ground scale apart,
with a gap of 1.5 stand widths between the groups.

| Map | Changes |
| --- | --- |
| Saltmarsh Gateway | One apron. Liner stands toward the main (L) runway taxiway, commuter stands toward the commuter (C) taxiway. Replace the 3 untyped stands with a 2 + 2 layout. |
| River Bend | Same pattern as Saltmarsh. Check the commuter taxiway end against the operations building and shorten it if needed. |
| Desert Parallel | Move FIELD OPS off the C runway's edge so the commuter taxiway reaches the apron. Then 2 + 2 stands on the strip between the runways and the building. |
| Twin Banks | Two aprons: liner stands on the east apron, commuter stands on the west apron. Replace the stand that sat across the west runway. |
| Specialist maps (Executive Point, Falcon Air Base, Freight Junction, Island Rescue, Metro International) | In `createSpecialistLayout`: end each taxiway on the apron in front of the terminal instead of under it, add a taxilane along the apron front and typed stands in two groups, and move the painted props (shelters, containers, gates) to the apron sides or behind the terminal so they don't sit on stands. |

All layouts must work in portrait, landscape, and square variants, and in
both landing-end modes.

## Part 4: Always-occupied parking

Changes to `GroundTraffic` (`src/game/ground/groundTraffic.ts`):

- **Type-aware claiming.** An arrival only claims a stand whose `accepts`
  matches its type, preferring the nearest free one.
- **Replace instead of expire.**
  - A parked aircraft no longer fades after 4 s.
  - When a new aircraft of the same type finishes parking, the previously
    parked aircraft of that type fades out, which keeps exactly one per type.
  - If no stand of the type is free (several arrivals at once), the arrival
    waits at its stand entry until one frees; the existing queue rule
    applies.
- **Seeded aircraft.** `startRun()` seeds one parked aircraft per type at that
  type's first stand, using reserved negative ids so they never clash with
  simulation ids.
  - Seeded aircraft are presentation only, like all ground traffic.
  - On a layout rebuild (resize) they are reseeded at the new positions.
- **Reduced motion.** A landed aircraft fades out at touchdown, then fades in
  directly at its stand, replacing the previous one. Nothing moves.
- **Helicopters.** No change.

## Part 5: Tests and QA

- **Layout contract test** (extending `tests/game/groundRoutes.test.ts`),
  for all 9 maps × 4 shapes × both modes:
  - every fixed-wing landing zone reaches at least one stand of its type
  - every stand lies inside its apron polygon
  - stands don't overlap at their type's ground footprint
  - liner and commuter groups are separated
  - lead-ins and taxilanes avoid buildings and runways
  - no stand sits under the HUD
- **Geometry test.** The painted taxiway geometry and the route geometry come
  from the same rounded points (the same function, the same output).
- **`GroundTraffic` tests:**
  - an arrival only takes stands of its type
  - parked aircraft stay until replaced
  - the previous one fades only after the newcomer stops
  - when the stands are full, the arrival waits
  - seeding gives exactly one per type
  - the reduced-motion handover works as described
- **Visual QA.**
  - Render every map with its stands and routes in portrait and landscape
    (the overlay capture used for the rollout work).
  - Run a real-game capture at desktop and phone sizes to confirm one parked
    aircraft per type at all times, and a clean handover.
- **Regressions:** the existing browser checks (`test-runway-ends`,
  `test-resize`) and all builds, then a new Android APK.

## Order of work

1. Data model, shared rounded geometry, and per-stand routes (Part 1), with
   the contract test.
2. Shared painters (Part 2), checked first on Saltmarsh Gateway.
3. Per-map layouts (Part 3): Saltmarsh and River Bend, then Twin Banks and
   Desert Parallel, then the specialist builder.
4. Always-occupied parking (Part 4).
5. Full QA (Part 5), DESIGN.md notes on the apron and taxiway visual
   language, and the Android build.

## Risks

- **Small aprons.** Some aprons, especially in portrait, may not fit 2 + 2
  stands at liner size. Mitigation: liner stands angled at 45°, or the apron
  polygon enlarged within its open area; the contract test catches overlaps.
- **Map previews and saved art.** Previews and store screenshots will look
  different. Re-capture the store screenshots afterwards if wanted.
- **Visual noise.** More markings could clutter small screens. Mitigation:
  markings stay thin and neutral except the type-coloured lead-ins, and
  mobile detail drops the joints and group labels.

## Implementation record

What was built, and where it differs from the plan above:

- **Stands are generated, not hand-placed.** `createApronMarkings`
  (`src/game/maps/shared/apronLayout.ts`) searches each apron for a taxilane
  and up to 2 stands per type. The same code serves all 9 maps and every
  shape, so there are no per-map stand tables.
  - The search tries grid positions and row angles: runway and apron-edge
    angles, their perpendiculars, and 30° steps.
  - It rejects stands that hit buildings, props, helipads, runways, the HUD,
    or the other type's group. The shortest taxiway connector wins.
  - Stands may overhang the drawn apron slightly. The painter merges the apron
    and stand pads into one paved shape (a convex hull).
  - If nothing fits, one stand is placed at the end of the taxiway.
- **Stand size.** Liner stands are 5% of the shorter screen side (at least
  30 px). Commuter stands are 4.4% (at least 26 px). Landed aircraft are
  drawn at half size or smaller, so they fit their stand.
- **Painting.** `paintAirfieldGround` (`rendering/shared-map/apronPainter.ts`)
  replaces each renderer's own apron, taxiway, and stand drawing. It paints
  taxiway rims, then the apron, then the taxiway surfaces (centre line and
  hold-short bars), then the markings.
  - Markings: taxilanes, stand outlines, type-coloured lead-ins, stop bars,
    upright L/C glyphs, and a dashed divider when the groups are close.
  - Joints are skipped on mobile detail.
- **Routes.** Each typed stand carries its own approach (taxilane plus
  lead-in, with rounded corners), so the drawn and flown paths are the same
  points.
- **Parking.**
  - Each type is seeded at its first stand when a shift starts.
  - A newcomer takes a free stand of its type. When the newcomer stops, the
    previously parked aircraft of that type fades out.
  - When every stand of the type is taken (small aprons with one stand), the
    newcomer claims the longest-held stand. The occupant stays until the
    newcomer is close, then fades, so the apron is never empty.
  - Parked aircraft never block taxiing traffic: stands sit beside the lanes.
- **Known limits.**
  - Some small or crowded aprons, mostly in portrait, fit only one stand of a
    type.
  - Desert Parallel's FIELD OPS building was not moved. The search places
    stands around it instead.

### Revision after browser review

Before stands are placed, a site-cleanup step (`src/game/maps/shared/siteCleanup.ts`) runs on every map.

- **Separation.** Each apron is cut back to leave a grass strip beside every runway (`runwayApronGap`). Stands, and the paving drawn under them, keep the same gap.
- **Square connectors.** Every runway-to-apron taxiway is rebuilt as a straight connector at a right angle to its runway.
  - It sits as near to the authored junction as possible.
  - It opens onto the most open apron space.
  - Each connector reserves the space in front of it, so the two types never compete.
  - Taxiway asphalt is painted under the apron, so the apron edge cuts it cleanly.
  - Each taxiway has a curved fillet where it leaves the runway, a soft shoulder, yellow edge lines and a hold-short bar.
- **Buildings.** Each apron keeps two buildings: the main one, then the largest.
  - Free-standing specialist fixtures (shelters, containers, kiosks) are also kept to two.
  - Buildings are placed along the apron edge, away from the connectors, clear of runways, helipads and taxiways.
  - A building that doesn't fit is drawn at 85% or 70% size. A minor one that still doesn't fit is left out.
  - Props and signs anchored on a building move with it. A terminal's gates move and scale with the terminal.
  - Specialist fixtures are now layout data (`SpecialistLayout.fixtures`), so they are treated as obstacles too.
- **Apron look.** Aprons are pale, low-contrast concrete taken from each map's ground colour (`apronTones`), so they never compete with traffic.
- **Stand markings.**
  - One smooth yellow guide per stand: a shared, rounded taxilane trunk with a curved branch onto the stand centre line.
  - The painted guide uses exactly the path the aircraft taxis, so shared stretches overlap without any pixel shift.
  - A white stop bar at the nose, a muted red stand safety box, and an L or C mark.
  - No turn along a guide doubles back.
- **Scenery.** Trees and decorations are skipped on helipads, aprons and runways (`clearOfAirfield`).
- **Desert Parallel.** The runways are further apart, the helipad sits past the commuter runway's end, and FIELD OPS is smaller, at the apron's west end.
- **Island Rescue.** The runways are further apart.
- **Stand search.**
  - A relaxed pass and a one-stand overhang pass before any fallback.
  - Stands keep clear of the other type's taxiway mouth.
  - Parked aircraft never block taxiing traffic.
- **Contract tests** (`tests/game/groundRoutes.test.ts`), for 7 viewport shapes × both landing modes:
  - no fallback stands
  - stands clear of the runway strip
  - square connectors
  - no building on a runway or helipad
  - no guide reversal
