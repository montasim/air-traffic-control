import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import type { MapBuilding } from '../../rendering/shared-map';
import type { MapHelipad, MapRunway, MapTaxiway } from '../shared/airfield';
import { createMapFrame, standardHud } from '../shared/frame';
import { createAirfieldGuidanceSurfaces } from '../shared/guidance';
import type { PlayableMapLayout } from '../types';

/**
 * Frost Crossing: a winter archipelago where the liner runway and the commuter
 * runway cross in an X. The apron sits in the open angle above the crossing,
 * rock ridges and snowy pines fill the land, and open water edges the map.
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
  /** Where the two runways cross. */
  readonly crossing: Vector2;
}

/** Design-frame geometry, in units of the shorter side from the screen centre (landscape). */
const CROSSING = { x: 0.178, y: 0.14 };
const COMMUTER_HEADING = -0.6; // up and to the right
const COMMUTER_LENGTH = 0.7;
const LINER = { x: -0.107, y: 0.14, length: 0.92 };
/** The crossing sits a quarter of the way up the commuter runway. */
const COMMUTER = {
  x: CROSSING.x + Math.cos(COMMUTER_HEADING) * COMMUTER_LENGTH * 0.25,
  y: CROSSING.y + Math.sin(COMMUTER_HEADING) * COMMUTER_LENGTH * 0.25,
};
const APRON = [[-0.36, -0.1], [0.0, -0.2], [0.21, -0.16], [0.24, 0.06], [-0.3, 0.07]];
const HELIPAD = { x: -0.56, y: -0.12 };
const WATER = [
  [[0.55, 0.3], [0.75, 0.22], [1.3, 0.25], [1.3, 0.9], [0.4, 0.9], [0.45, 0.45]],
  [[0.72, -0.9], [1.3, -0.9], [1.3, -0.3], [0.98, -0.36], [0.82, -0.5]],
  [[-1.3, 0.36], [-0.82, 0.39], [-0.64, 0.56], [-0.72, 0.9], [-1.3, 0.9]],
];
/** Long, low ridges rather than single peaks. */
const ROCKS = [
  [[-0.98, -0.4], [-0.84, -0.47], [-0.62, -0.45], [-0.5, -0.4], [-0.64, -0.36], [-0.86, -0.35]],
  [[-0.46, -0.5], [-0.3, -0.53], [-0.16, -0.5], [-0.3, -0.46]],
  [[0.28, -0.47], [0.44, -0.53], [0.66, -0.48], [0.5, -0.43]],
  [[-0.32, 0.4], [-0.16, 0.36], [0.06, 0.39], [-0.12, 0.44]],
];
const PINE_CLUSTERS = [[-0.42, -0.3], [0.08, -0.36], [0.34, 0.32], [-0.46, 0.3], [0.64, 0.06], [-0.8, 0.04], [-0.02, 0.4], [0.5, -0.26]];

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
  // Landings come down from the upper right, so touchdown is well clear of the crossing.
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
    { id: 'frost-taxi-commuter', path: [frame.point(COMMUTER.x + 0.02, COMMUTER.y - 0.06), apronCenter], width: unit * 0.015, connects: ['frost-commuter', 'apron'] },
    { id: 'frost-taxi-pad', path: [apronCenter, helipad.center], width: unit * 0.012, connects: ['apron', 'helipad'] },
  ];
  const buildings: MapBuilding[] = [
    { id: 'frost-terminal', center: frame.point(-0.1, -0.12), width: frame.length(0.16), height: frame.length(0.055), angle: frame.angle(0), kind: 'terminal' },
    { id: 'frost-hangar', center: frame.point(0.14, -0.12), width: frame.length(0.085), height: frame.length(0.048), angle: frame.angle(0), kind: 'hangar' },
  ];

  const pines = PINE_CLUSTERS.flatMap(([x, y], cluster) => Array.from({ length: 7 }, (_, i) => ({
    center: frame.point(x + (unitNoise(i, cluster) - 0.5) * 0.14, y + (unitNoise(i, cluster + 9) - 0.5) * 0.1),
    radius: unit * (0.011 + unitNoise(i, cluster + 17) * 0.006),
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
    apron,
    buildings,
    water: WATER.map((polygon) => polygon.map(point)),
    rocks: ROCKS.map((polygon) => polygon.map(point)),
    pines,
    crossing: point([CROSSING.x, CROSSING.y]),
  };
}
