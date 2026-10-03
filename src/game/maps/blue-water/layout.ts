import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import type { MapHelipad, MapRunway, MapTaxiway } from '../shared/airfield';
import { createCarrier, type Carrier } from '../shared/carrier';
import { createMapFrame, standardHud } from '../shared/frame';
import type { GuidanceSurface } from '../shared/guidance';
import type { PlayableMapLayout } from '../types';

/**
 * Blue Water: open ocean and one large carrier as the whole airfield. Commuters
 * choose between the axial and the angled deck lanes; helicopters take the two
 * deck pads. There are no liners out here.
 */
export interface BlueWaterLayout extends PlayableMapLayout {
  readonly runways: readonly MapRunway[];
  readonly taxiways: readonly MapTaxiway[];
  readonly helipads: readonly MapHelipad[];
  readonly carrier: Carrier;
  readonly deckApron: readonly Vector2[];
  readonly deckRunwayIds: readonly string[];
  readonly fixedObstacles: readonly Carrier['island'][];
}

/**
 * Design frame (landscape): the carrier a little off level, filling the screen's
 * long axis, bow to the left — so on a portrait screen the bow points up.
 */
const CARRIER = { x: -0.02, y: 0.04, length: 0.86, heading: Math.PI + 0.18 };

export function createBlueWaterLayout(width: number, height: number): BlueWaterLayout {
  const frame = createMapFrame(width, height, 0.52);
  const { unit } = frame;
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));
  const carrier = createCarrier({
    id: 'blue-carrier',
    center: frame.point(CARRIER.x, CARRIER.y),
    length: frame.length(CARRIER.length),
    angle: frame.angle(CARRIER.heading),
    lanes: ['axial', 'angled'],
    pads: 2,
    padRadius: unit * 0.034,
    taxiwayWidth: unit * 0.012,
  });

  const touchdown = (runway: MapRunway): Vector2 => ({
    x: runway.center.x - Math.cos(runway.angle) * runway.length * 0.3,
    y: runway.center.y - Math.sin(runway.angle) * runway.length * 0.3,
  });
  const landingZones: LandingZone[] = [
    ...carrier.runways.map((lane) => ({
      id: lane.zoneId, label: lane.designators[0], accepts: 'commuter' as const,
      position: touchdown(lane), angle: lane.angle, captureRadius: 36 * captureScale, color: AIRCRAFT_COLORS.commuter,
    })),
    ...carrier.helipads.map((pad, index) => ({
      id: pad.zoneId, label: `H${index + 1}`, accepts: 'rotor' as const,
      position: pad.center, angle: 0, captureRadius: 35 * captureScale, color: AIRCRAFT_COLORS.rotor,
    })),
  ];
  const guidanceSurfaces: GuidanceSurface[] = [
    // Carrier decks are landed from the stern only.
    ...carrier.runways.map((lane) => ({
      kind: 'runway' as const, runwayId: lane.id, designators: lane.designators, zoneId: lane.zoneId,
      center: lane.center, angle: lane.angle, length: lane.length, width: lane.width, oneWay: true,
    })),
    ...carrier.helipads.map((pad) => ({ kind: 'pad' as const, zoneId: pad.zoneId, center: pad.center, angle: 0, radius: pad.radius })),
  ];

  return {
    width,
    height,
    variant: frame.variant,
    landingZones,
    guidanceSurfaces,
    hudExclusionZones: standardHud(width, height),
    runways: carrier.runways,
    taxiways: carrier.taxiways,
    helipads: carrier.helipads,
    carrier,
    deckApron: carrier.deck,
    deckRunwayIds: carrier.runways.map((runway) => runway.id),
    fixedObstacles: [carrier.island],
  };
}
