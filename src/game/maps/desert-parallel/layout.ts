import type { AircraftType, LandingZone, Vector2 } from '../../../core/types';
import type { WorldDetailLevel } from '../../palette';
import type {
  AirfieldLayout,
  AirfieldPropAnchor,
  AirfieldSign,
  HoldShortMarker,
  MapRunway,
  MapTaxiway,
  ParkingStand
} from '../shared/airfield';
import { createAirfieldGuidanceSurfaces } from '../shared/guidance';
import type { HudExclusionZone, MapLayoutVariant, PlayableMapLayout } from '../types';

export type DesertRunwayId = 'mesa-runway' | 'wadi-runway';
export type DesertTaxiwayId = 'taxiway-mesa' | 'taxiway-wadi' | 'taxiway-pad';
export type DesertConnectionId = DesertRunwayId | 'apron' | 'helipad';

export interface RoutingArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DesertCoastFragment {
  readonly id: string;
  readonly points: readonly Vector2[];
}

export interface DesertServiceLandmark {
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly label: string;
}

export interface DesertDecoration {
  readonly id: string;
  readonly kind: 'strata' | 'scrub' | 'stone';
  readonly position: Vector2;
  readonly angle: number;
  readonly scale: number;
}

export interface DesertDetailBudget {
  readonly strata: number;
  readonly scrub: number;
  readonly stones: number;
  readonly coastFragments: number;
  readonly showLabels: boolean;
}

export const DESERT_DETAIL_BUDGETS: Record<WorldDetailLevel, DesertDetailBudget> = {
  mobile: { strata: 7, scrub: 10, stones: 7, coastFragments: 1, showLabels: false },
  tablet: { strata: 12, scrub: 18, stones: 12, coastFragments: 2, showLabels: true },
  desktop: { strata: 18, scrub: 28, stones: 20, coastFragments: 3, showLabels: true }
};

export const DESERT_PARALLEL_PALETTE = {
  mineralDeep: 0xa68e6d,
  mineralGround: 0xcbb48a,
  mineralHigh: 0xe0c89c,
  dryWash: 0xaf9978,
  coastDeep: 0x719fa4,
  coastShallow: 0xa5bfc0,
  apron: 0x3f413b,
  runway: 0x242a28,
  runwayShoulder: 0x4b4b42,
  runwayMarking: 0xe5dfcc,
  taxiwayMarking: 0xb99d5e,
  buildingWall: 0x655f52,
  buildingRoof: 0x343936,
  serviceRoad: 0x746d5a,
  scrub: 0x5d624b,
  stone: 0x756c58,
  liner: 0x8bdeda,
  commuter: 0xf0bd66,
  rotor: 0xf0836f
} as const;

interface NormalizedRunway {
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly landingAlong: number;
}

interface DesertProfile {
  readonly liner: NormalizedRunway;
  readonly commuter: NormalizedRunway;
  readonly helipad: Vector2;
  /** Paved between the runways; preparation trims it clear of both runway edges. */
  readonly apron: readonly Vector2[];
  /** Where both taxiways meet on the apron. */
  readonly apronCenter: Vector2;
  /** FIELD OPS sits at the quiet west end of the apron, away from the taxiways. */
  readonly ops: Vector2;
  readonly routingArea: RoutingArea;
  readonly coastFragments: readonly (readonly Vector2[])[];
}

const PROFILES: Record<MapLayoutVariant, DesertProfile> = {
  landscape: {
    liner: { center: { x: 0.72, y: 0.2 }, length: 0.84, width: 0.052, angle: 0.07, landingAlong: -0.36 },
    commuter: { center: { x: 0.64, y: 0.57 }, length: 0.62, width: 0.044, angle: 0.07, landingAlong: -0.34 },
    helipad: { x: 0.9, y: 0.45 },
    apron: [
      { x: 0.5, y: 0.2 },
      { x: 0.84, y: 0.24 },
      { x: 0.86, y: 0.6 },
      { x: 0.62, y: 0.62 },
      { x: 0.48, y: 0.5 }
    ],
    apronCenter: { x: 0.7, y: 0.4 },
    ops: { x: 0.56, y: 0.38 },
    routingArea: { x: 0, y: 0.16, width: 0.43, height: 0.84 },
    coastFragments: [
      [{ x: 0, y: 0.69 }, { x: 0.08, y: 0.73 }, { x: 0.13, y: 0.88 }, { x: 0.1, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0.9, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.11 }, { x: 0.96, y: 0.09 }],
      [{ x: 0.44, y: 0.92 }, { x: 0.52, y: 0.95 }, { x: 0.55, y: 1 }, { x: 0.43, y: 1 }]
    ]
  },
  portrait: {
    liner: { center: { x: 0.51, y: 0.17 }, length: 0.82, width: 0.054, angle: 0.04, landingAlong: -0.36 },
    commuter: { center: { x: 0.47, y: 0.45 }, length: 0.64, width: 0.045, angle: 0.04, landingAlong: -0.34 },
    helipad: { x: 0.87, y: 0.34 },
    apron: [
      { x: 0.16, y: 0.18 },
      { x: 0.78, y: 0.2 },
      { x: 0.78, y: 0.47 },
      { x: 0.3, y: 0.47 },
      { x: 0.14, y: 0.4 }
    ],
    apronCenter: { x: 0.52, y: 0.31 },
    ops: { x: 0.24, y: 0.3 },
    routingArea: { x: 0, y: 0.58, width: 1, height: 0.42 },
    coastFragments: [
      [{ x: 0, y: 0.62 }, { x: 0.12, y: 0.66 }, { x: 0.18, y: 0.82 }, { x: 0.12, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0.82, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.1 }, { x: 0.91, y: 0.08 }],
      [{ x: 0.7, y: 0.91 }, { x: 0.82, y: 0.94 }, { x: 0.86, y: 1 }, { x: 0.68, y: 1 }]
    ]
  },
  square: {
    liner: { center: { x: 0.59, y: 0.2 }, length: 0.8, width: 0.052, angle: 0.06, landingAlong: -0.36 },
    commuter: { center: { x: 0.54, y: 0.54 }, length: 0.63, width: 0.044, angle: 0.06, landingAlong: -0.34 },
    helipad: { x: 0.92, y: 0.47 },
    apron: [
      { x: 0.3, y: 0.2 },
      { x: 0.84, y: 0.24 },
      { x: 0.84, y: 0.56 },
      { x: 0.4, y: 0.56 },
      { x: 0.28, y: 0.46 }
    ],
    apronCenter: { x: 0.6, y: 0.37 },
    ops: { x: 0.38, y: 0.34 },
    routingArea: { x: 0, y: 0.61, width: 1, height: 0.39 },
    coastFragments: [
      [{ x: 0, y: 0.7 }, { x: 0.08, y: 0.72 }, { x: 0.14, y: 0.88 }, { x: 0.1, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0.9, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.12 }, { x: 0.96, y: 0.1 }],
      [{ x: 0.48, y: 0.92 }, { x: 0.59, y: 0.95 }, { x: 0.63, y: 1 }, { x: 0.46, y: 1 }]
    ]
  }
};

export interface DesertParallelLayout extends
  PlayableMapLayout,
  AirfieldLayout<DesertRunwayId, string, DesertTaxiwayId, DesertConnectionId> {
  readonly runways: readonly MapRunway<DesertRunwayId, string>[];
  readonly taxiways: readonly MapTaxiway<DesertTaxiwayId, DesertConnectionId>[];
  readonly holdShortMarkers: readonly HoldShortMarker<DesertRunwayId, DesertTaxiwayId>[];
  readonly parkingStands: readonly ParkingStand[];
  readonly propAnchors: readonly AirfieldPropAnchor[];
  readonly signs: readonly AirfieldSign[];
  readonly helipad: NonNullable<AirfieldLayout['helipad']>;
  readonly serviceLandmark: DesertServiceLandmark;
  readonly coastFragments: readonly DesertCoastFragment[];
  readonly decorations: readonly DesertDecoration[];
  readonly routingArea: RoutingArea;
  readonly detailBudget: DesertDetailBudget;
}

const variantFor = (width: number, height: number): MapLayoutVariant => {
  const aspect = width / height;
  if (aspect >= 1.6) return 'landscape';
  if (aspect <= 0.85) return 'portrait';
  return 'square';
};

const scalePoint = (point: Vector2, width: number, height: number): Vector2 => ({
  x: point.x * width,
  y: point.y * height
});

const interpolate = (first: Vector2, second: Vector2, progress: number): Vector2 => ({
  x: first.x + (second.x - first.x) * progress,
  y: first.y + (second.y - first.y) * progress
});

const pointOnRunway = (
  runway: Pick<MapRunway, 'center' | 'angle' | 'length'>,
  along: number,
  across = 0
): Vector2 => ({
  x: runway.center.x + Math.cos(runway.angle) * along - Math.sin(runway.angle) * across,
  y: runway.center.y + Math.sin(runway.angle) * along + Math.cos(runway.angle) * across
});

function createRunway(
  id: DesertRunwayId,
  accepts: Exclude<AircraftType, 'rotor'>,
  spec: NormalizedRunway,
  width: number,
  height: number,
  unit: number,
  designators: readonly [string, string],
  zoneId: string
): MapRunway<DesertRunwayId, string> {
  return {
    id,
    accepts,
    center: scalePoint(spec.center, width, height),
    length: spec.length * unit,
    width: spec.width * unit,
    angle: spec.angle,
    designators,
    zoneId
  };
}

function hudExclusions(width: number, height: number): HudExclusionZone[] {
  const edgeX = Math.max(24, width * 0.025);
  const edgeY = Math.max(24, height * 0.02);
  const statWidth = Math.min(220, width * 0.28);
  const statHeight = Math.min(112, height * 0.1);
  const pause = Math.min(112, Math.max(72, Math.min(width, height) * 0.09));
  return [
    { id: 'score', x: 0, y: 0, width: edgeX + statWidth, height: edgeY + statHeight },
    { id: 'best', x: width - edgeX - statWidth, y: 0, width: edgeX + statWidth, height: edgeY + statHeight },
    { id: 'pause', x: width - edgeX - pause, y: height - edgeY - pause, width: edgeX + pause, height: edgeY + pause }
  ];
}

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 91.733 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createDecorations(
  width: number,
  height: number,
  budget: DesertDetailBudget
): DesertDecoration[] {
  const groups: readonly [DesertDecoration['kind'], number, number][] = [
    ['strata', budget.strata, 3],
    ['scrub', budget.scrub, 7],
    ['stone', budget.stones, 13]
  ];
  return groups.flatMap(([kind, count, salt]) => Array.from({ length: count }, (_, index) => {
    const upperBand = kind === 'strata';
    return {
      id: `${kind}-${index + 1}`,
      kind,
      position: {
        x: width * (0.47 + deterministicUnit(index, salt) * 0.49),
        y: height * (upperBand
          ? 0.2 + deterministicUnit(index, salt + 1) * 0.34
          : 0.2 + deterministicUnit(index, salt + 1) * 0.36)
      },
      angle: (deterministicUnit(index, salt + 2) - 0.5) * 0.75,
      scale: 0.65 + deterministicUnit(index, salt + 3) * 0.7
    };
  }));
}

export function createDesertParallelLayout(
  width: number,
  height: number,
  detailLevel: WorldDetailLevel = 'desktop'
): DesertParallelLayout {
  const variant = variantFor(width, height);
  const profile = PROFILES[variant];
  const unit = Math.min(width, height);
  const budget = DESERT_DETAIL_BUDGETS[detailLevel];
  const liner = createRunway(
    'mesa-runway', 'liner', profile.liner, width, height, unit, ['08', '26'], 'desert-liner'
  );
  const commuter = createRunway(
    'wadi-runway', 'commuter', profile.commuter, width, height, unit, ['09', '27'], 'desert-commuter'
  );
  const runways = [liner, commuter] as const;
  const apron = profile.apron.map((point) => scalePoint(point, width, height));
  const helipadCenter = scalePoint(profile.helipad, width, height);
  const helipad = { center: helipadCenter, radius: unit * 0.052, zoneId: 'desert-helipad' };
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));
  const landingZones: LandingZone[] = [
    {
      id: liner.zoneId,
      label: liner.designators[0],
      accepts: 'liner',
      position: pointOnRunway(liner, liner.length * profile.liner.landingAlong),
      angle: liner.angle,
      captureRadius: 43 * captureScale,
      color: DESERT_PARALLEL_PALETTE.liner
    },
    {
      id: commuter.zoneId,
      label: commuter.designators[0],
      accepts: 'commuter',
      position: pointOnRunway(commuter, commuter.length * profile.commuter.landingAlong),
      angle: commuter.angle,
      captureRadius: 39 * captureScale,
      color: DESERT_PARALLEL_PALETTE.commuter
    },
    {
      id: helipad.zoneId,
      label: 'H',
      accepts: 'rotor',
      position: helipad.center,
      angle: 0,
      captureRadius: 41 * captureScale,
      color: DESERT_PARALLEL_PALETTE.rotor
    }
  ];
  const apronCenter = scalePoint(profile.apronCenter, width, height);
  const opsCenter = scalePoint(profile.ops, width, height);
  const taxiwayWidth = Math.max(10, unit * 0.016);
  const taxiways: readonly MapTaxiway<DesertTaxiwayId, DesertConnectionId>[] = [
    {
      id: 'taxiway-mesa',
      path: [pointOnRunway(liner, liner.length * 0.12), interpolate(liner.center, apronCenter, 0.62), apronCenter],
      width: taxiwayWidth,
      connects: ['mesa-runway', 'apron']
    },
    {
      id: 'taxiway-wadi',
      path: [pointOnRunway(commuter, commuter.length * 0.08), interpolate(commuter.center, apronCenter, 0.58), apronCenter],
      width: taxiwayWidth * 0.9,
      connects: ['wadi-runway', 'apron']
    },
    {
      id: 'taxiway-pad',
      path: [apronCenter, interpolate(apronCenter, helipadCenter, 0.55), helipadCenter],
      width: taxiwayWidth * 0.75,
      connects: ['apron', 'helipad']
    }
  ];
  const holdShortMarkers: readonly HoldShortMarker<DesertRunwayId, DesertTaxiwayId>[] = [
    {
      id: 'hold-mesa',
      position: taxiways[0].path[1],
      angle: liner.angle + Math.PI / 2,
      width: taxiwayWidth * 1.5,
      runwayId: 'mesa-runway',
      taxiwayId: 'taxiway-mesa'
    },
    {
      id: 'hold-wadi',
      position: taxiways[1].path[1],
      angle: commuter.angle + Math.PI / 2,
      width: taxiwayWidth * 1.4,
      runwayId: 'wadi-runway',
      taxiwayId: 'taxiway-wadi'
    }
  ];
  const serviceLandmark: DesertServiceLandmark = {
    center: opsCenter,
    width: unit * 0.13,
    height: unit * 0.06,
    angle: 0.02,
    label: 'FIELD OPS'
  };
  const parkingStands: readonly ParkingStand[] = [0.24, 0.5, 0.76].map((progress, index) => ({
    id: `desert-stand-${index + 1}`,
    label: `D${index + 1}`,
    position: interpolate(apron[0], apron[1], progress),
    angle: liner.angle + Math.PI / 2,
    length: unit * 0.043
  }));
  const propAnchors: readonly AirfieldPropAnchor[] = [
    { id: 'desert-ops', kind: 'service', label: 'OPS', position: opsCenter, angle: 0.02, size: unit * 0.075 },
    // Hangar and fuel keep beside FIELD OPS, leaving the middle of the apron to the stands.
    { id: 'desert-hangar', kind: 'hangar', label: 'HANGAR', position: pointOnRunway({ ...liner, center: opsCenter }, -unit * 0.12), angle: liner.angle, size: unit * 0.07 },
    { id: 'desert-fuel', kind: 'fuel', label: 'FUEL', position: pointOnRunway({ ...liner, center: opsCenter }, 0, unit * 0.075), angle: commuter.angle, size: unit * 0.034 },
    { id: 'desert-windsock', kind: 'windsock', label: 'WIND', position: interpolate(apron[4], opsCenter, 0.14), angle: liner.angle, size: unit * 0.022 }
  ];
  const signs: readonly AirfieldSign[] = [
    { id: 'desert-sign-a', kind: 'taxiway', label: 'A', position: taxiways[0].path[1], angle: liner.angle },
    { id: 'desert-sign-b', kind: 'taxiway', label: 'B', position: taxiways[1].path[1], angle: commuter.angle },
    { id: 'desert-sign-ops', kind: 'facility', label: 'FIELD OPS', position: opsCenter, angle: 0 }
  ];
  const routingArea = {
    x: profile.routingArea.x * width,
    y: profile.routingArea.y * height,
    width: profile.routingArea.width * width,
    height: profile.routingArea.height * height
  };
  const coastFragments = profile.coastFragments
    .slice(0, budget.coastFragments)
    .map((points, index) => ({
      id: `coast-${index + 1}`,
      points: points.map((point) => scalePoint(point, width, height))
    }));

  return {
    width,
    height,
    variant,
    landingZones,
    guidanceSurfaces: createAirfieldGuidanceSurfaces({ runways, helipad }),
    hudExclusionZones: hudExclusions(width, height),
    runways,
    taxiways,
    holdShortMarkers,
    parkingStands,
    propAnchors,
    signs,
    helipad,
    apron,
    serviceLandmark,
    coastFragments,
    decorations: createDecorations(width, height, budget),
    routingArea,
    detailBudget: budget
  };
}
