import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import type { MapBuilding } from '../../rendering/shared-map';
import type { MapHelipad, MapRunway, MapTaxiway } from '../shared/airfield';
import { createCarrier, type Carrier } from '../shared/carrier';
import { createMapFrame, standardHud } from '../shared/frame';
import { createAirfieldGuidanceSurfaces, type GuidanceSurface } from '../shared/guidance';
import type { PlayableMapLayout } from '../types';

/**
 * Carrier Coast: a diagonal coastline. Liners land at the shore airfield, commuters
 * on the carrier offshore, and helicopters on the field's pad or the carrier's deck.
 */
export interface CarrierCoastLayout extends PlayableMapLayout {
  readonly runways: readonly MapRunway[];
  readonly taxiways: readonly MapTaxiway[];
  readonly helipads: readonly MapHelipad[];
  readonly apron: readonly Vector2[];
  readonly buildings: readonly MapBuilding[];
  readonly carrier: Carrier;
  /** The carrier's flight deck: deck parking is laid out on it. */
  readonly deckApron: readonly Vector2[];
  readonly deckRunwayIds: readonly string[];
  readonly fixedObstacles: readonly Carrier['island'][];
  readonly land: readonly Vector2[];
  readonly coastline: readonly Vector2[];
  readonly islets: readonly (readonly Vector2[])[];
  readonly scrub: readonly { readonly center: Vector2; readonly radius: number }[];
}

/** Design frame (landscape), in units of the shorter side from the screen centre. */
const COAST = [[-0.3, -0.9], [-0.26, -0.56], [-0.12, -0.3], [-0.02, -0.06], [0.06, 0.2], [0.28, 0.4], [0.54, 0.56], [0.86, 0.95]];
const LINER = { x: 0.32, y: -0.22, length: 0.62 };
const APRON = [[0.04, -0.14], [0.54, -0.14], [0.58, 0.1], [0.12, 0.1]];
const LAND_PAD = { x: 0.58, y: 0.24 };
const CARRIER = { x: -0.42, y: 0.14, length: 0.5, heading: -0.6 };
const ISLETS = [[-0.78, -0.3, 0.07], [-0.36, -0.38, 0.05], [-0.14, 0.44, 0.06], [-0.84, 0.4, 0.045]];
const SCRUB = [[0.24, -0.42], [0.56, -0.4], [0.76, -0.1], [0.36, 0.3], [0.66, 0.4], [0.04, -0.32]];

const unitNoise = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export function createCarrierCoastLayout(width: number, height: number): CarrierCoastLayout {
  // Wide composition: on square screens it shrinks further so both sites and their approaches fit.
  const frame = createMapFrame(width, height, 0.8, 0.55);
  const { unit } = frame;
  const point = ([x, y]: readonly number[]) => frame.point(x, y);
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));

  const liner: MapRunway = {
    id: 'coast-liner', accepts: 'liner', zoneId: 'coast-liner-zone', designators: ['09', '27'],
    center: frame.point(LINER.x, LINER.y), length: frame.length(LINER.length), width: unit * 0.045, angle: frame.angle(0),
  };
  const landPad: MapHelipad = { center: point([LAND_PAD.x, LAND_PAD.y]), radius: unit * 0.042, zoneId: 'coast-field-pad' };
  const carrier = createCarrier({
    id: 'coast-carrier',
    center: frame.point(CARRIER.x, CARRIER.y),
    length: frame.length(CARRIER.length),
    angle: frame.angle(CARRIER.heading),
    lanes: ['axial'],
    pads: 1,
    padRadius: unit * 0.032,
    taxiwayWidth: unit * 0.012,
  });
  const deckLane = carrier.runways[0];

  const touchdown = (runway: MapRunway, share = 0.34): Vector2 => ({
    x: runway.center.x - Math.cos(runway.angle) * runway.length * share,
    y: runway.center.y - Math.sin(runway.angle) * runway.length * share,
  });
  const landingZones: LandingZone[] = [
    { id: liner.zoneId, label: liner.designators[0], accepts: 'liner', position: touchdown(liner), angle: liner.angle, captureRadius: 43 * captureScale, color: AIRCRAFT_COLORS.liner },
    { id: deckLane.zoneId, label: deckLane.designators[0], accepts: 'commuter', position: touchdown(deckLane, 0.3), angle: deckLane.angle, captureRadius: 36 * captureScale, color: AIRCRAFT_COLORS.commuter },
    { id: landPad.zoneId, label: 'H1', accepts: 'rotor', position: landPad.center, angle: 0, captureRadius: 39 * captureScale, color: AIRCRAFT_COLORS.rotor },
    ...carrier.helipads.map((pad, index) => ({ id: pad.zoneId, label: `H${index + 2}`, accepts: 'rotor' as const, position: pad.center, angle: 0, captureRadius: 34 * captureScale, color: AIRCRAFT_COLORS.rotor })),
  ];
  // In landing-zone order: the field's runway, the deck lane, then the pads.
  const [linerSurface, landPadSurface] = createAirfieldGuidanceSurfaces({ runways: [liner], helipad: landPad });
  const guidanceSurfaces: GuidanceSurface[] = [
    linerSurface,
    // Carrier decks are landed from the stern only.
    { kind: 'runway', runwayId: deckLane.id, designators: deckLane.designators, zoneId: deckLane.zoneId, center: deckLane.center, angle: deckLane.angle, length: deckLane.length, width: deckLane.width, oneWay: true },
    landPadSurface,
    ...carrier.helipads.map((pad) => ({ kind: 'pad' as const, zoneId: pad.zoneId, center: pad.center, angle: 0, radius: pad.radius })),
  ];

  const apronCenter = frame.point(0.3, -0.02);
  const taxiways: MapTaxiway[] = [
    { id: 'coast-taxi-liner', path: [frame.point(0.28, LINER.y), apronCenter], width: unit * 0.016, connects: ['coast-liner', 'apron'] },
    { id: 'coast-taxi-pad', path: [apronCenter, landPad.center], width: unit * 0.012, connects: ['apron', 'helipad'] },
    ...carrier.taxiways,
  ];
  const buildings: MapBuilding[] = [
    { id: 'coast-terminal', center: frame.point(0.28, 0.04), width: frame.length(0.15), height: frame.length(0.052), angle: frame.angle(0), kind: 'terminal' },
    { id: 'coast-tower', center: frame.point(0.5, 0.04), width: frame.length(0.07), height: frame.length(0.05), angle: frame.angle(0), kind: 'operations' },
  ];

  const coastline = COAST.map(point);
  const land = [...coastline, frame.point(1.4, 0.95), frame.point(1.4, -0.9)];
  const islets = ISLETS.map(([x, y, r], index) => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const wobble = 0.8 + unitNoise(i, index) * 0.35;
    return frame.point(x + Math.cos(a) * r * wobble, y + Math.sin(a) * r * 0.62 * wobble);
  }));
  const scrub = SCRUB.flatMap(([x, y], cluster) => Array.from({ length: 6 }, (_, i) => ({
    center: frame.point(x + (unitNoise(i, cluster) - 0.5) * 0.16, y + (unitNoise(i, cluster + 7) - 0.5) * 0.1),
    radius: unit * (0.009 + unitNoise(i, cluster + 13) * 0.006),
  })));

  return {
    width,
    height,
    variant: frame.variant,
    landingZones,
    guidanceSurfaces,
    hudExclusionZones: standardHud(width, height),
    runways: [liner, ...carrier.runways],
    taxiways,
    helipads: [landPad, ...carrier.helipads],
    apron: APRON.map(point),
    buildings,
    carrier,
    deckApron: carrier.deck,
    deckRunwayIds: carrier.runways.map((runway) => runway.id),
    fixedObstacles: [carrier.island],
    land,
    coastline,
    islets,
    scrub,
  };
}
