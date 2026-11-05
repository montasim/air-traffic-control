# Buildings at the apron ends: rollout to the other maps

Date: 2026-11-05

Status: Saltmarsh Gateway, River Bend and the four specialist airfields are done. Frost Crossing, Twin Banks and Desert Parallel are not started.

## The goal

On every land map, the terminal and hangar sit at the two ends of the parking area, lying along the edge they back onto. The parked planes line up in straight rows in the open middle. This is how real airfields look: building, then parked planes, then taxiway, then runway.

## What already exists (done on Saltmarsh Gateway)

- **One switch per map.** A layout that sets `buildingsAtApronEnds: true` gets the new arrangement. Every other map is unchanged.
- **Shared code, not per-map art.** The step that already places buildings automatically, `clearAirfieldSite` in [siteCleanup.ts](../src/game/maps/shared/siteCleanup.ts), now has an "ends" mode:
  - it prefers the far ends of the parking area, along the runway direction;
  - it sends the second building to the far end, while small extras such as containers and shelters stay beside the buildings;
  - it turns each building to lie along the parking-area edge it hugs.
- **Taxiways join near the middle.** On a switched-on map, each taxiway prefers to meet the parking area near its middle, so both ends stay free for buildings (`straightConnector` in siteCleanup.ts). This was added for River Bend, and Gateway uses it too.
- **Straight parking rows.** On a switched-on map, parking rows run only along or across the runways, never at a slant (`squareRows` in [apronLayout.ts](../src/game/maps/shared/apronLayout.ts)).
- **Safety net.** If the new arrangement fits fewer parking spots on a screen size than today's layout, that screen keeps today's layout (`withGroundTraffic` in [definition.ts](../src/game/maps/shared/definition.ts)). No map can lose a parking spot.
- **Test.** [apronEnds.test.ts](../tests/game/apronEnds.test.ts) checks every switched-on map at 5 screen sizes. Each map keeps at least as many spots as before, and maps with two buildings put them at opposite ends where the screen allows.
- **Gateway also needed a longer parking area**, with the helipad moved just off one end. Most maps will need a similar small layout tweak before their middle is roomy enough.

## Trial run: the switch turned on for every map

I switched it on for all 12 maps in a throwaway test and counted parking spots against today's layout. Each cell shows the spots with the new arrangement and the spots today. "fallback" means the safety net would keep today's layout on that screen.

| Map | Desktop 1600×900 | Portrait 900×1600 | Square 900×900 | Landscape phone 844×390 | Portrait phone 390×844 | Buildings placed |
| --- | --- | --- | --- | --- | --- | --- |
| Saltmarsh Gateway (done) | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 2 |
| River Bend | 4/4 | 4/4 | 3/3 | 2/2 | 4/4 | 2 |
| Desert Parallel | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 (landmark) |
| Twin Banks | 4/4 | 4/4 | 3/3 | 2/3 fallback | 3/3 | 0 |
| Falcon Air Base | 4/4 | 4/4 | 3/4 fallback | 4/3 | 4/4 | 1 |
| Executive Point | 3/4 fallback | 4/4 | 2/2 | 2/2 | 3/3 | 1 |
| Metro International | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 1 |
| Freight Junction | 4/4 | 4/4 | 4/4 | 3/3 | 3/4 fallback | 2 |
| Frost Crossing | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 2 |

What this shows:
- **Nothing breaks.** No map crashed, and no map loses a spot, thanks to the safety net.
- **The rule works as it is for most maps.** Each fallback cell needs a layout tweak like Gateway's to get the new arrangement on that screen size.
- **Some maps already have fewer than 4 spots today** on small screens. That isn't caused by this change, and it isn't in scope.
- **The counts don't show looks.** Every map still needs screenshots.

## Groups and order

1. **River Bend: done.** Its commuter runway runs under the left end of the parking area, so the area was lengthened to the right instead. It now fits more spots than before on square screens (4 instead of 3) and on landscape phones (3 instead of 2). Landscape phones still fall back to today's building placement. Every other size has the buildings at both ends.
2. **The four specialist airfields: done.** Metro International, Freight Junction, Falcon Air Base and Executive Point share [specialistAirfield.ts](../src/game/maps/shared/specialistAirfield.ts). They are switched on there, with Island Rescue excluded, and their parking area is 0.05 longer at each end.
   - **Freight Junction:** the warehouse is at one end with its containers, and the hangar at the other. On phones both buildings share an end, but the layout fits more spots than before (4 instead of 3 on landscape phones).
   - **Falcon Air Base and Executive Point:** their one building goes to an end, and the small extras go beside it or to the other end.
   - **Metro International:** its long passenger terminal, with its gate piers, sits along the parking area's lower edge at the left. That is how real passenger terminals look, so it stays that way.
   - **Executive Point on square screens** keeps today's layout, because the new arrangement would fit fewer spots there.
   - Spot counts rose on several sizes, for example Executive Point on portrait phones (3 to 4) and on square screens (2 to 3).
3. **Frost Crossing.** It has no fallbacks, but its runways cross. The "ends" direction currently follows the first runway, which may not be the parking area's long side here. Check the screenshots. If it looks wrong, take the direction from the runway nearest the parking area.
4. **Twin Banks and Desert Parallel.** Neither has a `buildings` list for the shared step to move. Desert Parallel uses one large landmark building, and Twin Banks draws its own. They need a closer look before switching on, and may be left as they are.
5. **Not included:** Carrier Coast, Blue Water and Island Rescue. Carrier decks and rescue pads have their own layouts, and "terminal and hangar at the ends" doesn't apply to them.

## Per-map checklist

For each map:

1. Set `buildingsAtApronEnds: true` in its layout (or once in `specialistAirfield.ts` for group 2).
2. Add the map to `apronEnds.test.ts`:
   - assert today's spot count at each of the 5 sizes;
   - assert opposite-end buildings where it has two.
3. Run `npm test`. The existing per-map tests already check that runways, the score, pause and speed corners, and taxi routes all stay clear.
4. Take screenshots at desktop, portrait phone, landscape phone and square, in day and night mode:
   - buildings at the ends, angled along the edge;
   - parking rows straight;
   - no taxiway running through a building.
5. If a size falls back or looks cramped, lengthen that map's parking area along its runways, and move a helipad that sits at an end off it, as on Gateway.

## Size

- **Switch and test per map:** a few lines.
- **Layout tweaks:** usually changing a few corner points of the parking area and the helipad position.
- **Rough total:** groups 1–3 come to about 7 maps, so about a day of work, most of it screenshot checks.

## Risks

- **Look, not rules.** Spot counts and routes are covered by tests, but "looks realistic" isn't. Each map needs its screenshots reviewed.
- **Fallback hides the new look.** On a screen that falls back, the player sees today's layout. That's safe but uneven between screen sizes. The trial run lists where this happens.
- **Crossing runways.** See group 3.
