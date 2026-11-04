# Landing, taxiway, and parking alignment fixes

Date: 2026-10-07

Status: implemented and verified on 2026-10-07. See the implementation record below.

## Intended result

Landed aircraft follow the visible ground guide into a parking stand that fits
on its supporting surface. Carrier parking and aircraft remain entirely on
the deck, and runway-exit turns no longer visibly drift from their guide.

## Confirmed problems

The browser audit covered all 12 maps at 1200×800 and 390×844, with single-end
landing enabled. All 48 controlled runway-to-parking replays reached parking.

| Finding | Evidence | Priority |
| --- | --- | --- |
| Carrier Coast parking overhangs the deck | Both commuter stand boxes have two corners outside the deck at both sizes; arriving aircraft also protrude over water. | First |
| Blue Water outer parking overhangs the deck | C2 has two corners outside the deck at both sizes; arriving aircraft also protrude. | First |
| Runway-exit movement and painted guides differ | River Bend commuter turns deviate by approximately 7.4 desktop CSS pixels and 4.7 mobile CSS pixels. Smaller mismatches also occur elsewhere. | Second |

Static taxiway and parking markings were not observed rendering above aircraft
bodies. Do not change rendering depth to address this report without a separate
reproduction. Other ordinary airports did not show comparable disconnected
parking areas.

## 1. Reproduce the failures in existing tests

Extend `tests/game/groundRoutes.test.ts` and, where appropriate,
`tests/game/frontierMaps.test.ts` before changing placement:

- Prepare Carrier Coast and Blue Water at the audited viewport-derived world
  sizes. Assert that every deck stand's complete rotated footprint is inside
  the rendered deck polygon. Checking only the stand centre misses this bug.
- Check Carrier Coast's shore and deck destinations separately, so the fix
  cannot move commuter parking onto land or liner parking onto the carrier.
- Capture the current River Bend runway-exit mismatch with a focused geometry
  regression. Exercise the final route consumed by ground traffic, including
  its join to the stand approach, rather than an isolated taxiway segment.

Reuse the existing geometry helpers and Vitest setup. The containment checks
must fail against the current layouts before the fix.

## 2. Keep carrier parking inside its deck

Primary files: `src/game/maps/shared/definition.ts` and
`src/game/maps/shared/apronLayout.ts`.

`createApronMarkings` currently searches all apron polygons and permits stand
corners outside them. That is intentional for expandable land paving, but is
invalid for a fixed carrier deck.

1. Use the existing `deckRunwayIds` and land/deck apron classification to bind
   each taxi exit to the appropriate parking surface. Pass the deck boundary
   into shared placement as a hard constraint; retain land apron expansion.
2. Reject deck candidates unless the full stand footprint fits inside the
   deck. Apply this constraint in every search pass, including the most relaxed
   fallback. Reuse `standFootprint`, `rectCorners`, and polygon checks.
3. Validate the connector, taxilane, and rounded stand lead-in against the deck
   boundary and existing runway, island, helipad, and neighbouring-stand
   clearances. A valid endpoint alone does not make a valid connecting path.
4. Prefer repositioning or rotating the existing row. If two stands cannot fit,
   use the existing single-stand search and verify occupied-stand replacement
   works. Never relax the deck boundary to force a requested stand count.
5. If no valid stand fits, adjust the authored carrier parking/taxiway geometry
   in `src/game/maps/shared/carrier.ts` or the affected map layout. Do not accept
   the generic route-end parking fallback unless its footprint is also valid.
   Every supported layout must retain a reachable commuter parking destination.

Check actual rendered aircraft outlines at their ground scale and final heading,
as well as stand boxes. Inspect the swept aircraft footprint during deck taxi
turns; adjust local clearance if wings or noses still cross the deck edge.
Do not shrink aircraft merely to conceal invalid placement.

## 3. Share the runway-exit curve with the painted guide

Primary files: `src/game/maps/shared/groundRoutes.ts` and
`src/game/rendering/shared-map/apronPainter.ts`.

Ground routes round a path that includes the runway approach to the taxiway.
The painter separately rounds the taxiway path, which lacks that approach.
Consequently, identical turn-radius constants do not produce identical curves.

1. Retain the existing route construction and `filletCorners` helper as the
   geometry source. Expose the necessary runway-exit guide segment from the
   prepared route, adding only the minimal data needed by the painter.
2. Draw that segment from the same points used for aircraft movement. Continue
   using the existing shared stand-approach geometry through the parking stop.
   Remove the independently rounded guide over the replaced segment.
3. Keep guide joins continuous and deduplicate shared segments. With two-end
   landing enabled, retain genuinely different approach branches without
   double-stroking their shared taxiway or painting a full landing trajectory.
4. Confirm the curve remains within the taxiway surface; adapt the existing
   junction surface only where needed. Preserve hold-short markings and the
   intended runway rollout/back-taxi behaviour.

Add a regression asserting that the painted guide uses the movement points
through the exit and stand handover. In browser replays, target aircraft-centre
alignment within one CSS pixel of the applicable guide during ordinary taxi
turns. Check rollout and intentional pivot sections separately.

## 4. Validate the complete landing-to-parking sequence

Run focused regressions, then the full checks once:

```sh
npm test -- tests/game/groundRoutes.test.ts tests/game/groundTraffic.test.ts tests/game/frontierMaps.test.ts
npm test
npm run build
```

Use the existing browser tooling to replay actual `PlayScene` arrivals with
isolated test state:

- Cover all 12 maps at desktop 1200×800, portrait 390×844, and landscape
  844×390, with both landing-mode settings. Carrier lanes remain one-way.
- Exercise each fixed-wing runway route and every available stand, including
  seeded parking, repeated arrivals, queuing, and occupied-stand replacement.
- Capture before/after views of Carrier Coast, Blue Water, and River Bend;
  inspect mobile Falcon Air Base and Freight Junction turns as well.
- Spot-check reduced motion, pause/resume, and resizing while taxiing. Verify
  the aircraft still settles on its stand and ends aligned with the stop bar.
- Check all three aircraft liveries remain readable at ground scale and that
  the ground guide stays visually underneath aircraft.

Keep a small repeatable browser check in the existing `scripts/` convention if
the geometry tests cannot cover rendered-outline containment. Reuse installed
Playwright; no new testing dependency or general-purpose harness is needed.

## Completion criteria

- No carrier stand box or parked aircraft outline extends beyond the deck at
  any tested size; taxiing aircraft remain on the deck throughout the turn.
- Each fixed-wing destination retains a reachable, correctly typed parking
  location without crossing blocked surfaces or switching between shore/deck.
- Movement and painting consume the same exit-curve geometry, with smooth,
  continuous visible joins and no duplicate guide over the old curve.
- All existing ground-traffic behaviour and validation checks pass.

This work does not change scoring, XP, landing capture, collision sizes,
aircraft speeds, or livery unlocks. Preserve the existing uncommitted livery
work. Implement and verify deck containment first, then curve alignment, so
each confirmed problem can be reviewed independently.


## Implementation record

- Shared stand placement now separates deck and land apron candidates, requires
  complete deck stand footprints and taxilane connectors to stay inside the
  deck, and refuses the unsafe route-end fallback on carriers.
- Compact carrier layouts needed more usable parking space. The shared carrier
  deck has a wider aft starboard parking shelf, and deck taxilane tails are
  shorter. Runway dimensions, landing zones, aircraft sizes, and speeds remain
  unchanged by this fix. The existing row search selects one or two valid stands
  according to available space.
- `taxiGuidePaths` derives exit guides directly from prepared movement routes
  and their existing stand handovers. The painter no longer rounds a separate
  taxi guide. Identical guide segments are deduplicated.
- Map renderers paint guides after runway surfaces, which previously covered
  the start of exit curves. Aircraft rendering depth is unchanged.
- Regression tests reproduced 28 failing carrier containment cases before the
  fix. They now check stand corners and moving/parked aircraft outlines across
  seven world shapes and both runway modes, plus curved guides from both
  landing directions.

Validation completed:

- `npm test`: 1,039 tests passed across 40 files, including existing following,
  parking replacement, and reduced-motion checks.
- `npm run build`: passed.
- Browser replay: 825 arrivals passed across all 12 maps, desktop/portrait/
  landscape viewports, both runway-mode settings, and Classic/Signal/Midnight
  liveries. Repeated arrivals and reduced motion reached parking; measured
  taxi-guide deviation stayed below 0.01 world units and no checked commuter
  outline crossed a carrier deck edge while taxiing or parked.
- Another 177 browser arrivals on River Bend, Carrier Coast, and Blue Water
  passed with pause/resume and a FIT viewport resize during taxiing. Ground
  traffic stayed frozen while paused and subsequently reached parking.
- Visually inspected the carrier parking and River Bend guide joins in the
  generated browser screenshots.

Repeat the browser check against a running Vite development server:

```sh
GROUND_TEST_URL=http://127.0.0.1:4287/ node scripts/test-ground-parking.mjs
```

The script uses disposable browser state and writes screenshots and results to
`test-results/ground-parking/`. It includes pause/resize checks for subsequent
full runs. No dependency was added for this work.
