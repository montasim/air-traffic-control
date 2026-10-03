# Three new maps: Frost Crossing, Carrier Coast, Blue Water

Status: implemented. See "Implementation record" at the end for how the build differs from the plan.

## Goal

Add three original maps inspired by the reference screenshots:

| Map | Idea | New challenge |
| --- | --- | --- |
| **Frost Crossing** | Snowy archipelago, two runways crossing in an X | Liner and commuter traffic meet at a runway intersection |
| **Carrier Coast** | Diagonal coastline: a land airfield on the shore, a carrier offshore | Two separate landing sites across the map |
| **Blue Water** | Open ocean, one large carrier as the whole airfield | Every arrival converges on one deck |

All three are our own art in the existing flat, quiet style. Nothing is copied
from the reference games.

They reuse everything from the realistic-aprons work:

- site cleanup (grass strip, square connectors, two buildings per apron)
- typed stands
- smooth guide lines
- one parked aircraft per type
- muted parking areas
- clear helipads

## Decisions

- **Carrier motion: static.** The carrier never moves. A painted wake gives the
  sense of motion while routes stay fair and the ground layer stays simple.
- **Aircraft types: unchanged.** Liner, commuter, and helicopter. Carrier decks
  accept commuters and helicopters only; liners always land on land runways.
- **Career: the last three unlocks.**
  - Frost Crossing → Chief Controller (which unlocks nothing today).
  - Two new ranks above it: **Flight Director** → Carrier Coast, then
    **Air Boss** → Blue Water.
- **Crossing runways: no new rule.** Aircraft only have to avoid each other, as
  now. A collision still ends the shift. Play stays quiet, with no "runway
  occupied" warnings.

## Current state (research)

- Maps register through `MAP_IDS` (`src/game/maps/mapIds.ts`),
  `MAP_DEFINITIONS` (`src/game/maps/registry.ts`), and `defineMap()`.
  - The registry throws unless every id has exactly one definition.
- `MapMetadata` carries the name, description, category
  (`src/game/maps/categories.ts`), layout label, and unlock rank.
- Unlocks come from `RANK_CATALOG` (`src/progression/ranks.ts`):
  - Each rank lists the maps it unlocks.
  - `chief-controller` is the top rank and unlocks nothing.
- Traffic comes from `MAP_TRAFFIC_PROFILES` (`src/game/maps/trafficProfiles.ts`).
  - `specialistProfile()` sets type weights, opening spawns, intervals, a traffic
    cap, and spawn corridors.
- Terrain texture comes from
  `presentationMaterialForMap` (`src/game/assets/presentationAssets.ts`), which
  is a `Record<MapId, 'mineral' | 'meadow'>`, so new maps must be added there.
- Map previews (home, map picker, career) are rendered from each map's own
  renderer (`createMapPreviews` in `src/main.ts`), so no preview art is needed.
- Every landing zone accepts one aircraft type. Fixed-wing zones carry an
  `approach` for runway-end landing.
- Ground preparation (`withGroundTraffic` in `shared/definition.ts`) runs
  `clearAirfieldSite`, `createApronMarkings`, and `createGroundRoutes`.
  - Any layout key ending in `apron` is treated as an apron polygon.
- Contract tests iterate `MAP_DEFINITIONS`, so new maps are checked
  automatically:
  - `tests/game/groundRoutes.test.ts`: 7 shapes × both landing modes.
  - `mapContract`, `runwaySeparation`, and the resize browser checks.

## Part 1: Shared groundwork

### 1a. Site options per map

Carrier decks break two assumptions of `clearAirfieldSite`: there is no grass
beside a deck lane, and connectors are short deck lines, not right-angle
taxiways. Add an optional `site` field to the layout (read by
`withGroundTraffic`):

```ts
interface SiteOptions {
  /** Clear strip between runway edge and apron; defaults to runwayApronGap(unit). */
  readonly runwayGap?: number;
  /** 'square' rebuilds runway taxiways as right-angle connectors (default); 'authored' keeps them. */
  readonly connectors?: 'square' | 'authored';
  /** Paint style for aprons, taxiways, and stands. */
  readonly surface?: 'airfield' | 'deck';
}
```

- Land airfields use the defaults.
- Carrier decks use a small gap (the deck's foul line, about 4 px), authored
  connectors, and the `deck` surface.
- `runwayApronGap`, `apronClearOfRunways`, stand placement, and the paved-apron
  clip all read the gap from here instead of the fixed rule.

### 1b. Carrier module (`src/game/maps/shared/carrier.ts`)

`createCarrier(center, length, angle, options)` returns plain layout data:

- **Hull polygon:** a pointed bow, a flat stern, and a sponson bulge on the
  island side.
- **Deck polygon:** a little inside the hull. Exposed as the layout key
  `deckApron`, so it becomes the apron.
- **Axial lane:** along the deck centre line. A `MapRunway` with
  `accepts: 'commuter'`, landing from the stern.
- **Angled lane:** rotated about 9° off the axial line toward the port side,
  starting at the stern. A second commuter `MapRunway`, used on Blue Water only.
- **Helipad spots (2):** forward on the starboard side.
- **Island superstructure:** one `MapBuilding` on the starboard edge.
- **Authored deck connectors:** short lines from each lane's rollout end to the
  parking strip along the starboard edge.
- **Wake:** two tapering trails behind the stern (scenery only).

Lane lengths must keep the existing runway proportions
(`runway.length / runway.width > 14`, enforced by the layout tests). Capture
radii scale like the specialist maps (`u * 0.026`).

### 1c. Deck painter (`src/game/rendering/shared-map/carrierPainter.ts`)

- **Hull:** a dark grey-blue fill, a thin lighter rim, and a soft shadow on the
  water.
- **Deck surface:** muted dark grey. It plays the role the concrete plays on
  land: quiet, never competing with traffic.
- **Lane markings:**
  - a white dashed centre line
  - white edge lines
  - a broad colour bar at the touchdown end in the accepting type's colour (the
    same language as `paintRunway`)
  - a small vector "CV" glyph at the bow, our own hull marking (none of the
    reference's numbering)
- **Foul line:** a thin muted red line between the landing lanes and the parking
  strip.
- **Stands:** `paintApronMarkings` with the `deck` surface:
  - yellow guides and white stop bars
  - the red safety box drawn dashed, as on real decks
- **Helipad spots:** the existing `paintHelipad`, scaled to fit the deck.

`paintAirfieldGround` gains a branch on `site.surface`, so the deck reuses the
guide, stand, and approach code unchanged.

### 1d. Terrain materials and scenery

- Extend the presentation material type to
  `'mineral' | 'meadow' | 'snow' | 'ocean'`. The new maps paint procedurally, so
  the two new materials can start as untextured flat fills, with
  `materialTextureKey` left unset.
- **Snow scenery:**
  - pale snow fields and ice-blue meltwater
  - dark slate rock ridges (irregular polygons)
  - snowy pine clumps (`paintTree` with a white cap)
- **Ocean scenery:**
  - deep water with lighter swell bands
  - sparse whitecap dots
  - small sandbar islets
- All scenery goes through `clearOfAirfield`, so nothing sits on runways,
  aprons, decks, or helipads.

### 1e. Category and ranks

- Add the category `naval: 'Naval aviation'` in `categories.ts`. Frost Crossing
  uses `regional`.
- **Ranks:**
  - Append two ranks after `chief-controller`: `flight-director` and `air-boss`,
    with rising requirements in the existing pattern (e.g. 340 / 55 / 19 / 5 and
    460 / 70 / 22 / 6).
  - Give `chief-controller` the unlock `frost-crossing`.
- Check every place that assumes `chief-controller` is the top rank:
  - the promotion UI
  - "next rank" progress
  - achievements
  - `tests/progression/ranks.test.ts`
  - the save migration that validates `earnedRankId` (new ids must be accepted;
    old saves stay valid)

### 1f. Single-type fixed-wing maps

Blue Water has no liner runway. Confirm that each of these handles a map without
a liner zone:

- traffic spawning (liner weight 0)
- destination checks
- guidance
- achievements (e.g. "mixed fleet")

Fix whatever assumes both fixed-wing types exist. The stand layout already
skips types with no taxiway.

## Part 2: Frost Crossing (`src/game/maps/frost-crossing/`)

**Composition (landscape starting point, in fractions of the screen):**

- **Liner runway:** horizontal, centre (0.50, 0.62), length 0.95 u.
- **Commuter runway:** crossing it, centre (0.66, 0.55), length 0.78 u, angle
  about −35°. The intersection sits right of centre, like the reference.
- **Apron:** in the upper open angle of the X, between the two runways.
  - Site cleanup trims it clear of both runways.
  - The connectors are square to their own runway and never cross the other
    (already enforced).
- **Buildings (2):** a terminal and a hangar on the apron edge.
- **Helipad:** beside the apron, away from both runways.
- **Scenery:**
  - rock ridges at the upper left
  - pine clumps around the field
  - open water at the right and bottom edges

**Variants:**

- **Portrait:** rotate the X so the liner runway runs along the long axis.
- **Square:** shrink both runways.
- Both runway-end modes must work.

**Crossing rules:**

- The rollout ground layer may cross the intersection: it is presentation only.
- Check how `aircraftCollision` treats two landing aircraft that meet at the
  intersection, and keep today's behaviour (a collision ends the shift).
- Decision recorded above: no occupancy rule.

**Traffic:**

- Default-like weights: liner 0.4, commuter 0.4, rotor 0.2.
- Spawn corridors keep away from the intersection's approaches.

**Renderer:** a custom one, `frost-crossing/renderer.ts`. It draws the snow
terrain, then `paintAirfieldGround`, the runways, the helipad, and the buildings,
then the snow scenery.

## Part 3: Carrier Coast (`src/game/maps/carrier-coast/`)

**Composition (landscape):**

- **Coastline:** runs diagonally from the upper middle to the lower right.
  - Sea on the left with swell bands and two sandbar islets.
  - Sandy scrubland on the right, with a green shore band between.
- **Land airfield (upper right):**
  - A **liner runway**.
  - A paved **spur** joining at an angle. It is the taxiway to the apron, not a
    second runway: the reference's angled strip reads as a connector here.
  - An **apron** with two buildings (terminal and control tower) and a land
    **helipad**.
- **Carrier (left middle):**
  - About 0.42 u long, angled about −35°, like the reference.
  - Its **axial lane** takes **commuters**. The angled lane is drawn as deck
    marking only.
  - **Two deck helipads.**
  - Deck parking for commuters along the starboard edge.
- **The routing tension:** liners must go to the land runway, commuters to the
  carrier, and helicopters to any of three pads. Routes cross the coastline.

**Variants:**

- **Portrait:** the coast runs top-left to bottom-right, with the carrier in the
  lower sea and the airfield in the upper land.
- **Square:** in between.

**Traffic:** liner 0.35, commuter 0.35, rotor 0.3. Spawns come from all sea
edges and the land edges.

## Part 4: Blue Water (`src/game/maps/blue-water/`)

**Composition:**

- Open ocean, with the carrier as the only airfield.
  - Portrait first, like the reference: the carrier runs along the long axis.
    Landscape lays it diagonally. About 0.78 u long.
- **Deck:**
  - The **axial lane** and the **angled lane**, both commuter zones. Two zones
    of the same type give the player a choice, like the reference's crossed
    deck.
  - **Two deck helipads.**
  - The **island superstructure** as the only building.
- **Deck parking:** two commuter stands on the starboard parking strip, with the
  usual one-parked-aircraft rule.
- **Scenery:**
  - a long wake behind the stern
  - whitecap dots
  - nothing else, so the deck reads at a glance

**Traffic:**

- Liner weight 0, commuter 0.55, rotor 0.45.
- The highest pace in the game: a short late spawn interval and the
  specialist-style cap of 9.
- Spawns come from all four edges.

**Difficulty check:** with every route converging on one deck, playtest that
Easy stays survivable. Tune spawn intervals rather than adding rules.

## Part 5: Wiring, tests, and QA

**Registration:**

- Add the three ids to `MAP_IDS` and a new `NAVAL_MAP_IDS` group (Frost Crossing
  joins the expansion group).
- Add them to `MAP_DEFINITIONS`, `MAP_TRAFFIC_PROFILES`, and the presentation
  material record.

**Contract tests** (existing loops pick up the new maps). Add:

- **Carrier geometry:**
  - lanes and helipad spots lie on the deck
  - the island stays clear of every lane
  - deck stands sit off the lanes behind the foul line
- **Frost Crossing:** the runways intersect, and the apron and stands stay clear
  of both.
- **Blue Water:** has no liner zone, spawns no liners, and every arrival has a
  reachable destination.
- **Ranks:** unlock order, and saves at `chief-controller` keep working.

**Browser QA (as before):**

- Capture every new map at the start of a shift in landscape, portrait, square,
  and the user's 1600×1520 canvas.
- Run a 60-second auto-routed shift on each: landings, rollout, taxi along the
  guides, parking, and replacement, with nothing stuck and no errors.
- Run the existing checks: `test:runway-ends`, `test:resize`, and
  `test:resize:maps` (they iterate every map).

**Builds:**

- The web, desktop, and Android builds.
- A new debug APK.

## Order of work

1. Shared groundwork (Part 1): site options, the carrier module and painter,
   materials, the category and ranks, and the single-type audit.
2. Frost Crossing: no carrier; it proves the crossing runways and snow scenery.
3. Carrier Coast: the first carrier, plus the two-site routing.
4. Blue Water: the carrier-only, portrait-first map.
5. QA, the docs update (README map list and this plan's implementation record),
   the builds, and the APK.

## Risks

- **Deck scale on phones.** A 0.42 u carrier on a 390 px-tall landscape phone is
  small.
  - Lanes keep the minimum capture radius, and deck stands use the stand-size
    floors (26–30 px), so the carrier may need to grow on mobile detail.
  - The resize checks catch overlaps.
- **Crossing traffic feels unfair.** If playtests show constant intersection
  collisions on Easy, widen the angle between the runways or move the
  intersection off the touchdown zones before adding any rule.
- **The top-rank assumption.** Code or copy may treat Chief Controller as the
  final rank (e.g. "You've reached the top"); the audit in 1e covers it.
- **Visual noise at sea.** Swell bands and whitecaps must stay faint so routes
  and the deck stay readable. Mobile detail drops the whitecaps.

## Implementation record

What was built, and where it differs from the plan above:

- **Layout frame.** `createMapFrame` (`src/game/maps/shared/frame.ts`) composes each new map once in a landscape design frame.
  - Portrait turns the composition a quarter turn.
  - Squarer screens scale it down until its reach fits (Carrier Coast may shrink to 55%).
  - `standardHud` gives the usual score, best, and pause exclusions.
- **Site options became deck conventions** rather than a `site` field:
  - A layout key starting with `deck` (`deckApron`) marks a carrier flight deck. It is never clipped, paved, or used for building placement.
  - `deckRunwayIds` names the deck lanes. They keep a 4 px foul-line clearance (`DECK_LANE_CLEARANCE`) instead of the grass strip, and their taxi lines stay as authored, painted as guide lines only.
  - `fixedObstacles` lists structures that keep their place (the island).
  - Runway guidance gained `oneWay`: deck lanes get no reverse end, even in two-end mode.
- **Carrier** (`shared/carrier.ts`, `rendering/shared-map/carrierPainter.ts`):
  - **Geometry:** the hull, deck, axial lane, angled lane (9° to port), one or two deck pads, the island, deck taxi lines to a parking point aft of the island, and the wake.
  - **Painting:** edge lines, a dashed centre line, a commuter-colour touchdown bar, arresting wires, a red foul line, and a muted grey deck.
  - **Labels:** the lanes are AX (axial) and AN (angled).
  - The planned "CV" bow glyph was left out to keep the deck quiet.
- **Materials.** No new texture files.
  - Frost Crossing and Carrier Coast overlay the existing mineral grain on their painted terrain. Blue Water paints the sea flat.
  - The material record maps the new ids to `mineral`.
- **Scenery** (`rendering/shared-map/sceneryPainter.ts`): low-poly rock ridges, snowy pines, sandbar islets, whitecaps, and swell bands. All of it skips helipads, aprons, decks, and runways.
- **Carrier Coast.** The land airfield and coastline sit 0.06 units nearer the centre than planned, which leaves room for approaches to the runway end near the screen edge in portrait.
- **Blue Water.** The design heading points the bow left in landscape, so it points up in portrait, as in the reference.
- **Career.**
  - `chief-controller` unlocks Frost Crossing. The new ranks are `flight-director` (Carrier Coast; 340 / 55 / 19 / 5) and `air-boss` (Blue Water; 460 / 70 / 22 / 6).
  - The new maps form `FRONTIER_MAP_IDS`, so the "Expanded Horizons" achievement still counts the five specialist maps.
- **Tests:**
  - `tests/game/frontierMaps.test.ts` covers screen bounds and the HUD in 6 shapes, a landing on every destination at every difficulty, the crossing runways, carrier deck geometry, and no liners on Blue Water.
  - The runway-end tests accept one-way deck lanes.
  - The site contract applies the deck rules.
