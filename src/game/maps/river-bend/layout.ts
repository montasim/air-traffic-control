import type { AircraftType, LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import { deterministicUnit, type MapBuilding } from '../../rendering/shared-map';
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
import type {
  HudExclusionZone,
  MapLayoutVariant,
  PlayableMapLayout
} from '../types';

export type RiverRunwayId = 'river-main' | 'river-commuter';
export type RiverRunwayDesignator = '07' | '25' | '12' | '30';
export type RiverTaxiwayId = 'river-alpha' | 'river-bravo' | 'river-pad-link';
export type RiverConnectionId = RiverRunwayId | 'river-apron' | 'river-helipad';

export interface RiverBankTree {
  readonly center: Vector2;
  readonly radius: number;
}

interface NormalizedRunway {
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly landingAlong: number;
}

interface RiverProfile {
  readonly main: NormalizedRunway;
  readonly commuter: NormalizedRunway;
  readonly apron: readonly Vector2[];
  readonly helipad: Vector2;
  readonly riverPath: readonly Vector2[];
  readonly riverWidth: number;
  readonly buildings: readonly Vector2[];
}

export interface RiverBendLayout extends
  PlayableMapLayout,
  AirfieldLayout<
    RiverRunwayId,
    RiverRunwayDesignator,
    RiverTaxiwayId,
    RiverConnectionId
  > {
  readonly variant: MapLayoutVariant;
  readonly runways: readonly MapRunway<RiverRunwayId, RiverRunwayDesignator>[];
  readonly taxiways: readonly MapTaxiway<RiverTaxiwayId, RiverConnectionId>[];
  readonly holdShortMarkers: readonly HoldShortMarker<RiverRunwayId, RiverTaxiwayId>[];
  readonly parkingStands: readonly ParkingStand[];
  readonly propAnchors: readonly AirfieldPropAnchor[];
  readonly signs: readonly AirfieldSign[];
  readonly helipad: { readonly center: Vector2; readonly radius: number; readonly zoneId: string };
  readonly riverPath: readonly Vector2[];
  readonly riverWidth: number;
  readonly riverIsSceneryOnly: true;
  readonly fieldPolygons: readonly (readonly Vector2[])[];
  readonly bankTrees: readonly RiverBankTree[];
  readonly buildings: readonly MapBuilding[];
  readonly accessRoad: readonly Vector2[];
  readonly routeHaloColor: number;
}

const PROFILES: Readonly<Record<MapLayoutVariant, RiverProfile>> = {
  landscape: {
    main: {
      center: { x: 0.72, y: 0.24 },
      length: 0.59,
      width: 0.046,
      angle: 0.04,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.78, y: 0.53 },
      length: 0.44,
      width: 0.038,
      angle: 0.32,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.63, y: 0.29 },
      { x: 0.76, y: 0.28 },
      { x: 0.89, y: 0.39 },
      { x: 0.81, y: 0.5 },
      { x: 0.64, y: 0.48 },
      { x: 0.59, y: 0.38 }
    ],
    helipad: { x: 0.61, y: 0.45 },
    riverPath: [
      { x: -0.06, y: 0.45 },
      { x: 0.12, y: 0.53 },
      { x: 0.19, y: 0.68 },
      { x: 0.08, y: 0.83 },
      { x: 0.22, y: 1.06 }
    ],
    riverWidth: 0.085,
    buildings: [{ x: 0.72, y: 0.42 }, { x: 0.65, y: 0.34 }, { x: 0.82, y: 0.43 }]
  },
  portrait: {
    main: {
      center: { x: 0.58, y: 0.19 },
      length: 0.74,
      width: 0.057,
      angle: 0.025,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.7, y: 0.46 },
      length: 0.53,
      width: 0.045,
      angle: 0.32,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.43, y: 0.22 },
      { x: 0.64, y: 0.215 },
      { x: 0.86, y: 0.31 },
      { x: 0.74, y: 0.4 },
      { x: 0.47, y: 0.39 },
      { x: 0.39, y: 0.31 }
    ],
    helipad: { x: 0.43, y: 0.37 },
    riverPath: [
      { x: -0.08, y: 0.28 },
      { x: 0.15, y: 0.38 },
      { x: 0.12, y: 0.56 },
      { x: 0.28, y: 0.72 },
      { x: 0.11, y: 0.9 },
      { x: 0.24, y: 1.07 }
    ],
    riverWidth: 0.09,
    buildings: [{ x: 0.62, y: 0.34 }, { x: 0.49, y: 0.27 }, { x: 0.77, y: 0.34 }]
  },
  square: {
    main: {
      center: { x: 0.64, y: 0.23 },
      length: 0.67,
      width: 0.052,
      angle: 0.035,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.73, y: 0.57 },
      length: 0.49,
      width: 0.041,
      angle: 0.32,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.5, y: 0.28 },
      { x: 0.69, y: 0.27 },
      { x: 0.88, y: 0.39 },
      { x: 0.78, y: 0.51 },
      { x: 0.52, y: 0.49 },
      { x: 0.45, y: 0.38 }
    ],
    helipad: { x: 0.48, y: 0.40 },
    riverPath: [
      { x: -0.06, y: 0.38 },
      { x: 0.16, y: 0.49 },
      { x: 0.2, y: 0.66 },
      { x: 0.09, y: 0.82 },
      { x: 0.24, y: 1.06 }
    ],
    riverWidth: 0.085,
    buildings: [{ x: 0.68, y: 0.43 }, { x: 0.56, y: 0.33 }, { x: 0.8, y: 0.43 }]
  }
};

function selectVariant(width: number, height: number): MapLayoutVariant {
  const aspect = width / height;
  if (aspect >= 1.18) return 'landscape';
  if (aspect <= 0.85) return 'portrait';
  return 'square';
}

function scalePoint(point: Vector2, width: number, height: number): Vector2 {
  return { x: point.x * width, y: point.y * height };
}

function scalePolygon(points: readonly Vector2[], width: number, height: number): Vector2[] {
  return points.map((point) => scalePoint(point, width, height));
}

function interpolate(first: Vector2, second: Vector2, progress: number): Vector2 {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress
  };
}

function runwayPoint(runway: Pick<MapRunway, 'center' | 'angle'>, distance: number): Vector2 {
  return {
    x: runway.center.x + Math.cos(runway.angle) * distance,
    y: runway.center.y + Math.sin(runway.angle) * distance
  };
}

function createRunway(
  id: RiverRunwayId,
  accepts: Exclude<AircraftType, 'rotor'>,
  designators: readonly [RiverRunwayDesignator, RiverRunwayDesignator],
  zoneId: string,
  spec: NormalizedRunway,
  width: number,
  height: number,
  unit: number
): MapRunway<RiverRunwayId, RiverRunwayDesignator> {
  return {
    id,
    accepts,
    center: scalePoint(spec.center, width, height),
    length: spec.length * unit,
    width: spec.width * unit,
    angle: spec.angle,
    zoneId,
    designators
  };
}

function hudExclusions(width: number, height: number): HudExclusionZone[] {
  const padX = Math.max(24, width * 0.025);
  const padY = Math.max(24, height * 0.02);
  const labelWidth = Math.min(220, width * 0.28);
  const labelHeight = Math.min(112, height * 0.1);
  const pauseSize = Math.min(112, Math.max(72, Math.min(width, height) * 0.09));
  return [
    { id: 'score', x: 0, y: 0, width: padX + labelWidth, height: padY + labelHeight },
    {
      id: 'best',
      x: width - padX - labelWidth,
      y: 0,
      width: padX + labelWidth,
      height: padY + labelHeight
    },
    {
      id: 'pause',
      x: width - padX - pauseSize,
      y: height - padY - pauseSize,
      width: padX + pauseSize,
      height: padY + pauseSize
    }
  ];
}

function fieldPolygons(width: number, height: number, variant: MapLayoutVariant): Vector2[][] {
  const landscape = variant === 'landscape';
  const portrait = variant === 'portrait';
  const specs: readonly (readonly Vector2[])[] = landscape
    ? [
        [{ x: 0, y: 0.02 }, { x: 0.3, y: 0.04 }, { x: 0.29, y: 0.36 }, { x: 0, y: 0.39 }],
        [{ x: 0.31, y: 0.03 }, { x: 0.55, y: 0.05 }, { x: 0.54, y: 0.34 }, { x: 0.31, y: 0.36 }],
        [{ x: 0.32, y: 0.57 }, { x: 0.63, y: 0.54 }, { x: 0.66, y: 1 }, { x: 0.3, y: 1 }],
        [{ x: 0.67, y: 0.56 }, { x: 1, y: 0.58 }, { x: 1, y: 1 }, { x: 0.68, y: 1 }]
      ]
    : portrait
      ? [
          [{ x: 0, y: 0.02 }, { x: 0.35, y: 0.03 }, { x: 0.34, y: 0.27 }, { x: 0, y: 0.28 }],
          [{ x: 0.35, y: 0.44 }, { x: 1, y: 0.43 }, { x: 1, y: 0.64 }, { x: 0.36, y: 0.65 }],
          [{ x: 0.34, y: 0.67 }, { x: 1, y: 0.66 }, { x: 1, y: 0.82 }, { x: 0.31, y: 0.83 }],
          [{ x: 0.31, y: 0.85 }, { x: 1, y: 0.84 }, { x: 1, y: 1 }, { x: 0.28, y: 1 }]
        ]
      : [
          [{ x: 0, y: 0.02 }, { x: 0.37, y: 0.03 }, { x: 0.36, y: 0.35 }, { x: 0, y: 0.37 }],
          [{ x: 0.31, y: 0.57 }, { x: 0.65, y: 0.54 }, { x: 0.66, y: 1 }, { x: 0.28, y: 1 }],
          [{ x: 0.67, y: 0.56 }, { x: 1, y: 0.58 }, { x: 1, y: 1 }, { x: 0.68, y: 1 }]
        ];
  return specs.map((polygon) => scalePolygon(polygon, width, height));
}

function bankTrees(path: readonly Vector2[], unit: number): RiverBankTree[] {
  return Array.from({ length: 34 }, (_, index) => {
    const segmentIndex = index % (path.length - 1);
    const progress = deterministicUnit(index, 317);
    const first = path[segmentIndex];
    const second = path[segmentIndex + 1];
    const angle = Math.atan2(second.y - first.y, second.x - first.x);
    const offset = unit * (0.055 + deterministicUnit(index, 331) * 0.035)
      * (index % 2 === 0 ? -1 : 1);
    return {
      center: {
        x: first.x + (second.x - first.x) * progress - Math.sin(angle) * offset,
        y: first.y + (second.y - first.y) * progress + Math.cos(angle) * offset
      },
      radius: unit * (0.006 + deterministicUnit(index, 337) * 0.006)
    };
  });
}

export function createRiverBendLayout(width: number, height: number): RiverBendLayout {
  const variant = selectVariant(width, height);
  const profile = PROFILES[variant];
  const unit = Math.min(width, height);
  const main = createRunway(
    'river-main',
    'liner',
    ['07', '25'],
    'river-liner-zone',
    profile.main,
    width,
    height,
    unit
  );
  const commuter = createRunway(
    'river-commuter',
    'commuter',
    ['12', '30'],
    'river-commuter-zone',
    profile.commuter,
    width,
    height,
    unit
  );
  const runways = [main, commuter] as const;
  const apron = scalePolygon(profile.apron, width, height);
  const helipad = {
    center: scalePoint(profile.helipad, width, height),
    radius: unit * 0.043,
    zoneId: 'river-rotor-zone'
  };
  const taxiwayWidth = Math.max(10, unit * 0.017);
  const taxiways: readonly MapTaxiway<RiverTaxiwayId, RiverConnectionId>[] = [
    {
      id: 'river-alpha',
      path: [runwayPoint(main, -main.length * 0.02), interpolate(apron[0], apron[1], 0.35)],
      width: taxiwayWidth,
      connects: ['river-main', 'river-apron']
    },
    {
      id: 'river-bravo',
      path: [runwayPoint(commuter, -commuter.length * 0.08), interpolate(apron[2], apron[3], 0.4)],
      width: taxiwayWidth * 0.9,
      connects: ['river-commuter', 'river-apron']
    },
    {
      id: 'river-pad-link',
      path: [interpolate(apron[4], apron[5], 0.45), helipad.center],
      width: taxiwayWidth * 0.76,
      connects: ['river-apron', 'river-helipad']
    }
  ];
  const captureScale = Math.max(0.86, Math.min(1.18, unit / 900));
  const landingZones: LandingZone[] = [
    {
      id: main.zoneId,
      label: '07',
      accepts: 'liner',
      position: runwayPoint(main, main.length * profile.main.landingAlong),
      angle: main.angle,
      captureRadius: 43 * captureScale,
      color: AIRCRAFT_COLORS.liner
    },
    {
      id: commuter.zoneId,
      label: '12',
      accepts: 'commuter',
      position: runwayPoint(commuter, commuter.length * profile.commuter.landingAlong),
      angle: commuter.angle,
      captureRadius: 39 * captureScale,
      color: AIRCRAFT_COLORS.commuter
    },
    {
      id: helipad.zoneId,
      label: 'H',
      accepts: 'rotor',
      position: helipad.center,
      angle: 0,
      captureRadius: 41 * captureScale,
      color: AIRCRAFT_COLORS.rotor
    }
  ];
  const buildingCenters = profile.buildings.map((point) => scalePoint(point, width, height));
  const buildings: MapBuilding[] = [
    {
      id: 'river-terminal',
      center: buildingCenters[0],
      width: unit * 0.13,
      height: unit * 0.035,
      angle: main.angle,
      kind: 'terminal'
    },
    {
      id: 'river-hangar',
      center: buildingCenters[1],
      width: unit * 0.075,
      height: unit * 0.052,
      angle: main.angle,
      kind: 'hangar'
    },
    {
      id: 'river-operations',
      center: buildingCenters[2],
      width: unit * 0.052,
      height: unit * 0.045,
      angle: commuter.angle,
      kind: 'operations'
    }
  ];
  const riverPath = profile.riverPath.map((point) => scalePoint(point, width, height));
  const holdShortMarkers: readonly HoldShortMarker<RiverRunwayId, RiverTaxiwayId>[] = [
    {
      id: 'river-hold-alpha',
      position: taxiways[0].path[0],
      angle: main.angle + Math.PI / 2,
      width: taxiwayWidth * 1.45,
      runwayId: main.id,
      taxiwayId: taxiways[0].id
    },
    {
      id: 'river-hold-bravo',
      position: taxiways[1].path[0],
      angle: commuter.angle + Math.PI / 2,
      width: taxiwayWidth * 1.4,
      runwayId: commuter.id,
      taxiwayId: taxiways[1].id
    }
  ];
  const parkingStands: ParkingStand[] = [0.25, 0.52, 0.78].map((progress, index) => ({
    id: `river-stand-${index + 1}`,
    label: `R${index + 1}`,
    position: interpolate(apron[1], apron[3], progress),
    angle: main.angle + Math.PI / 2,
    length: unit * 0.04
  }));
  const propAnchors: AirfieldPropAnchor[] = [
    {
      id: 'river-terminal-anchor',
      kind: 'service',
      label: 'TERMINAL',
      position: buildings[0].center,
      angle: buildings[0].angle,
      size: buildings[0].width
    },
    {
      id: 'river-hangar-anchor',
      kind: 'hangar',
      label: 'HANGAR',
      position: buildings[1].center,
      angle: buildings[1].angle,
      size: buildings[1].width
    },
    {
      id: 'river-windsock',
      kind: 'windsock',
      label: 'WIND',
      position: interpolate(apron[3], apron[4], 0.48),
      angle: main.angle,
      size: unit * 0.022
    }
  ];
  const signs: AirfieldSign[] = [
    {
      id: 'river-sign-alpha',
      kind: 'taxiway',
      label: 'A',
      position: interpolate(taxiways[0].path[0], taxiways[0].path[1], 0.68),
      angle: main.angle
    },
    {
      id: 'river-sign-bravo',
      kind: 'taxiway',
      label: 'B',
      position: interpolate(taxiways[1].path[0], taxiways[1].path[1], 0.68),
      angle: commuter.angle
    }
  ];

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
    riverPath,
    riverWidth: profile.riverWidth * unit,
    riverIsSceneryOnly: true,
    fieldPolygons: fieldPolygons(width, height, variant),
    bankTrees: bankTrees(riverPath, unit),
    buildings,
    accessRoad: [
      scalePoint({ x: 0.98, y: variant === 'portrait' ? 0.45 : 0.55 }, width, height),
      apron[3]
    ],
    routeHaloColor: 0x24281f
  };
}

