import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import type { MapBuilding } from '../../rendering/shared-map';
import type { MapHelipad, MapRunway, MapTaxiway } from '../shared/airfield';
import { createMapFrame, standardHud } from '../shared/frame';
import { createAirfieldGuidanceSurfaces } from '../shared/guidance';
import type { PlayableMapLayout } from '../types';

/**
 * Frost Crossing: a winter archipelago with two parallel runways, the long liner
 * runway below the apron and the commuter runway above it, so they never meet. Slate rock and snowy pine forest fill
 * the ice-blue land, and open sea with drifting floes edges the map.
 */
export interface FrostCrossingLayout extends PlayableMapLayout {
  readonly runways: readonly MapRunway[];
  readonly taxiways: readonly MapTaxiway[];
  readonly helipad: MapHelipad;
  readonly apron: readonly Vector2[];
  readonly buildings: readonly MapBuilding[];
  readonly water: readonly (readonly Vector2[])[];
  readonly rocks: readonly (readonly Vector2[])[];
  readonly pines: readonly { readonly center: Vector2; readonly radius: number }[];
}

/** Design-frame geometry, in units of the shorter side from the screen centre (landscape). */
const COMMUTER_HEADING = 0;
const COMMUTER_LENGTH = 0.6;
const LINER = { x: -0.107, y: 0.14, length: 0.92 };
/** Parallel to the liner runway on the far side of the apron, so the two never meet. */
const COMMUTER = { x: 0.0, y: -0.34 };
const APRON = [[-0.36, -0.1], [0.0, -0.2], [0.21, -0.16], [0.24, 0.06], [-0.3, 0.07]];
const HELIPAD = { x: -0.56, y: -0.12 };
const WATER = [
  // Open sea along the whole right side, its shore winding in and out past the runway ends.
  [[0.62, -0.9], [1.3, -0.9], [1.3, 0.9], [0.3, 0.9], [0.38, 0.62], [0.58, 0.5], [0.66, 0.28], [0.8, 0.1], [0.74, -0.12], [0.86, -0.3], [0.72, -0.5]],
  // Small bays in the far corners on the left.
  [[-1.3, -0.9], [-0.55, -0.9], [-0.6, -0.72], [-0.85, -0.62], [-1.3, -0.6]],
  [[-1.3, 0.6], [-0.95, 0.56], [-0.75, 0.7], [-0.7, 0.9], [-1.3, 0.9]],
];
/** A broken mass of slate rock in the upper left, as many jagged blocks, and one low outcrop below the liner runway. */
const ROCKS = [
  [[-0.86, -0.4], [-0.78, -0.45], [-0.68, -0.43], [-0.7, -0.36], [-0.8, -0.34]],
  [[-0.66, -0.42], [-0.58, -0.46], [-0.5, -0.42], [-0.54, -0.36], [-0.62, -0.36]],
  [[-0.84, -0.3], [-0.74, -0.32], [-0.68, -0.26], [-0.76, -0.21], [-0.86, -0.24]],
  [[-0.66, -0.32], [-0.56, -0.33], [-0.5, -0.27], [-0.58, -0.22], [-0.66, -0.25]],
  [[-0.78, -0.18], [-0.68, -0.2], [-0.62, -0.14], [-0.7, -0.09], [-0.8, -0.12]],
  [[-0.9, -0.48], [-0.86, -0.5], [-0.8, -0.47], [-0.84, -0.44]],
  [[0.0, 0.42], [0.14, 0.38], [0.26, 0.42], [0.12, 0.47]],
];
/** Dense pine forest: below the rocks, west of the apron, and in a band below the liner runway. */
const PINE_CLUSTERS = [[-0.88, 0.04], [-0.6, 0.04], [-0.45, 0.3], [-0.18, 0.3], [0.42, 0.26], [0.45, -0.24], [0.12, -0.46], [-0.92, 0.3], [-0.4, -0.46]];

const unitNoise = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export function createFrostCrossingLayout(width: number, height: number): FrostCrossingLayout {
  const frame = createMapFrame(width, height, 0.65);
  const { unit } = frame;
  const point = ([x, y]: readonly number[]) => frame.point(x, y);
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));

  const liner: MapRunway = {
    id: 'frost-liner', accepts: 'liner', zoneId: 'frost-liner-zone', designators: ['09', '27'],
    center: frame.point(LINER.x, LINER.y), length: frame.length(LINER.length), width: unit * 0.045, angle: frame.angle(0),
  };
  // Landings come in from the right.
  const commuter: MapRunway = {
    id: 'frost-commuter', accepts: 'commuter', zoneId: 'frost-commuter-zone', designators: ['22', '04'],
    center: frame.point(COMMUTER.x, COMMUTER.y), length: frame.length(COMMUTER_LENGTH), width: unit * 0.04, angle: frame.angle(COMMUTER_HEADING + Math.PI),
  };
  const runways = [liner, commuter];
  const helipad: MapHelipad = { center: point([HELIPAD.x, HELIPAD.y]), radius: unit * 0.045, zoneId: 'frost-helipad' };

  const touchdown = (runway: MapRunway): Vector2 => ({
    x: runway.center.x - Math.cos(runway.angle) * runway.length * 0.34,
    y: runway.center.y - Math.sin(runway.angle) * runway.length * 0.34,
  });
  const landingZones: LandingZone[] = [
    { id: liner.zoneId, label: liner.designators[0], accepts: 'liner', position: touchdown(liner), angle: liner.angle, captureRadius: 43 * captureScale, color: AIRCRAFT_COLORS.liner },
    { id: commuter.zoneId, label: commuter.designators[0], accepts: 'commuter', position: touchdown(commuter), angle: commuter.angle, captureRadius: 39 * captureScale, color: AIRCRAFT_COLORS.commuter },
    { id: helipad.zoneId, label: 'H', accepts: 'rotor', position: helipad.center, angle: 0, captureRadius: 41 * captureScale, color: AIRCRAFT_COLORS.rotor },
  ];

  const apron = APRON.map(point);
  const apronCenter = frame.point(-0.04, -0.06);
  // Authored roughly; preparation rebuilds them as square connectors.
  const taxiways: MapTaxiway[] = [
    { id: 'frost-taxi-liner', path: [frame.point(-0.12, LINER.y), apronCenter], width: unit * 0.016, connects: ['frost-liner', 'apron'] },
    { id: 'frost-taxi-commuter', path: [frame.point(COMMUTER.x + 0.02, COMMUTER.y + 0.06), apronCenter], width: unit * 0.015, connects: ['frost-commuter', 'apron'] },
  ];
  const buildings: MapBuilding[] = [
    { id: 'frost-terminal', center: frame.point(-0.1, -0.12), width: frame.length(0.16), height: frame.length(0.055), angle: frame.angle(0), kind: 'terminal' },
    { id: 'frost-hangar', center: frame.point(0.14, -0.12), width: frame.length(0.085), height: frame.length(0.048), angle: frame.angle(0), kind: 'hangar' },
  ];

  const pines = PINE_CLUSTERS.flatMap(([x, y], cluster) => Array.from({ length: 36 }, (_, i) => ({
    center: frame.point(x + (unitNoise(i, cluster) - 0.5) * 0.2, y + (unitNoise(i, cluster + 9) - 0.5) * 0.12),
    radius: unit * (0.014 + unitNoise(i, cluster + 17) * 0.008),
  })));

  return {
    width,
    height,
    variant: frame.variant,
    landingZones,
    guidanceSurfaces: createAirfieldGuidanceSurfaces({ runways, helipad }),
    hudExclusionZones: standardHud(width, height),
    runways,
    taxiways,
    helipad,
    // Settled onto the apron once stands are placed; the authored spot is the fallback.
    helipadsOnApron: true,
    apron,
    buildings,
    water: WATER.map((polygon) => polygon.map(point)),
    rocks: ROCKS.map((polygon) => polygon.map(point)),
    pines,
  };
}
