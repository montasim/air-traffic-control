import type { AircraftType, LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
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
import type { MapBuilding } from '../../rendering/shared-map';
import { deterministicUnit } from '../../rendering/shared-map';

export type GatewayRunwayId = 'gateway-main' | 'gateway-commuter';
export type GatewayRunwayDesignator = '08' | '26' | '13' | '31';
export type GatewayTaxiwayId = 'gateway-alpha' | 'gateway-bravo' | 'gateway-pad-link';
export type GatewayConnectionId = GatewayRunwayId | 'gateway-apron' | 'gateway-helipad';

export interface MapRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GatewayTree {
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

interface GatewayProfile {
  readonly main: NormalizedRunway;
  readonly commuter: NormalizedRunway;
  readonly apron: readonly Vector2[];
  readonly helipad: Vector2;
  readonly openAirspaceStart: number;
  readonly poolAnchors: readonly Vector2[];
  readonly buildingAnchors: readonly Vector2[];
}

export interface SaltmarshGatewayLayout extends
  PlayableMapLayout,
  AirfieldLayout<
    GatewayRunwayId,
    GatewayRunwayDesignator,
    GatewayTaxiwayId,
    GatewayConnectionId
  > {
  readonly variant: MapLayoutVariant;
  readonly runways: readonly MapRunway<GatewayRunwayId, GatewayRunwayDesignator>[];
  readonly taxiways: readonly MapTaxiway<GatewayTaxiwayId, GatewayConnectionId>[];
  readonly holdShortMarkers: readonly HoldShortMarker<GatewayRunwayId, GatewayTaxiwayId>[];
  readonly parkingStands: readonly ParkingStand[];
  readonly propAnchors: readonly AirfieldPropAnchor[];
  readonly signs: readonly AirfieldSign[];
  readonly helipad: { readonly center: Vector2; readonly radius: number; readonly zoneId: string };
  readonly openAirspace: MapRect;
  readonly fieldPolygons: readonly (readonly Vector2[])[];
  readonly tidalPools: readonly (readonly Vector2[])[];
  readonly treeBelt: readonly GatewayTree[];
  readonly serviceRoads: readonly (readonly Vector2[])[];
  readonly buildings: readonly MapBuilding[];
  readonly routeHaloColor: number;
}

const PROFILES: Readonly<Record<MapLayoutVariant, GatewayProfile>> = {
  landscape: {
    main: {
      center: { x: 0.7, y: 0.27 },
      length: 0.72,
      width: 0.054,
      angle: 0.035,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.755, y: 0.425 },
      length: 0.55,
      width: 0.046,
      angle: -0.72,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.63, y: 0.32 },
      { x: 0.75, y: 0.31 },
      { x: 0.87, y: 0.43 },
      { x: 0.79, y: 0.56 },
      { x: 0.64, y: 0.54 },
      { x: 0.59, y: 0.43 }
    ],
    helipad: { x: 0.61, y: 0.51 },
    openAirspaceStart: 0.65,
    poolAnchors: [{ x: 0.12, y: 0.2 }, { x: 0.27, y: 0.46 }, { x: 0.45, y: 0.77 }],
    buildingAnchors: [{ x: 0.72, y: 0.47 }, { x: 0.64, y: 0.37 }, { x: 0.82, y: 0.49 }]
  },
  portrait: {
    main: {
      center: { x: 0.56, y: 0.22 },
      length: 0.78,
      width: 0.058,
      angle: 0.025,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.68, y: 0.32 },
      length: 0.57,
      width: 0.047,
      angle: -0.78,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.43, y: 0.25 },
      { x: 0.66, y: 0.245 },
      { x: 0.86, y: 0.34 },
      { x: 0.73, y: 0.43 },
      { x: 0.46, y: 0.41 },
      { x: 0.38, y: 0.33 }
    ],
    helipad: { x: 0.42, y: 0.39 },
    openAirspaceStart: 0.55,
    poolAnchors: [{ x: 0.13, y: 0.46 }, { x: 0.75, y: 0.53 }, { x: 0.28, y: 0.73 }],
    buildingAnchors: [{ x: 0.61, y: 0.36 }, { x: 0.48, y: 0.29 }, { x: 0.75, y: 0.37 }]
  },
  square: {
    main: {
      center: { x: 0.58, y: 0.26 },
      length: 0.75,
      width: 0.056,
      angle: 0.035,
      landingAlong: -0.34
    },
    commuter: {
      center: { x: 0.7, y: 0.42 },
      length: 0.56,
      width: 0.046,
      angle: -0.78,
      landingAlong: -0.32
    },
    apron: [
      { x: 0.46, y: 0.31 },
      { x: 0.67, y: 0.3 },
      { x: 0.86, y: 0.43 },
      { x: 0.74, y: 0.57 },
      { x: 0.48, y: 0.53 },
      { x: 0.41, y: 0.42 }
    ],
    helipad: { x: 0.44, y: 0.5 },
    openAirspaceStart: 0.65,
    poolAnchors: [{ x: 0.13, y: 0.2 }, { x: 0.23, y: 0.49 }, { x: 0.82, y: 0.72 }],
    buildingAnchors: [{ x: 0.65, y: 0.48 }, { x: 0.51, y: 0.36 }, { x: 0.77, y: 0.49 }]
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

function scalePolygon(
  points: readonly Vector2[],
  width: number,
  height: number
): Vector2[] {
  return points.map((point) => scalePoint(point, width, height));
}

function interpolate(first: Vector2, second: Vector2, progress: number): Vector2 {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress
  };
}

function runwayPoint(
  runway: Pick<MapRunway, 'center' | 'angle'>,
  distance: number
): Vector2 {
  return {
    x: runway.center.x + Math.cos(runway.angle) * distance,
    y: runway.center.y + Math.sin(runway.angle) * distance
  };
}

function createRunway(
  id: GatewayRunwayId,
  accepts: Exclude<AircraftType, 'rotor'>,
  designators: readonly [GatewayRunwayDesignator, GatewayRunwayDesignator],
  zoneId: string,
  spec: NormalizedRunway,
  width: number,
  height: number,
  unit: number
): MapRunway<GatewayRunwayId, GatewayRunwayDesignator> {
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

function irregularPool(
  anchor: Vector2,
  width: number,
  height: number,
  unit: number,
  index: number
): Vector2[] {
  const center = scalePoint(anchor, width, height);
  const radiusX = unit * (0.035 + index * 0.007);
  const radiusY = radiusX * (0.55 + index * 0.07);
  return Array.from({ length: 9 }, (_, pointIndex) => {
    const angle = (pointIndex / 9) * Math.PI * 2;
    const irregularity = 0.8 + deterministicUnit(pointIndex, 101 + index * 17) * 0.34;
    return {
      x: center.x + Math.cos(angle) * radiusX * irregularity,
      y: center.y + Math.sin(angle) * radiusY * irregularity
    };
  });
}

function fieldPolygons(width: number, height: number, variant: MapLayoutVariant): Vector2[][] {
  const specs: Readonly<Record<MapLayoutVariant, readonly (readonly Vector2[])[]>> = {
    landscape: [
      [{ x: 0, y: 0.05 }, { x: 0.22, y: 0.03 }, { x: 0.25, y: 0.3 }, { x: 0, y: 0.34 }],
      [{ x: 0.25, y: 0.04 }, { x: 0.48, y: 0.06 }, { x: 0.46, y: 0.32 }, { x: 0.27, y: 0.3 }],
      [{ x: 0, y: 0.38 }, { x: 0.28, y: 0.35 }, { x: 0.31, y: 0.62 }, { x: 0, y: 0.65 }],
      [{ x: 0.32, y: 0.37 }, { x: 0.55, y: 0.34 }, { x: 0.56, y: 0.61 }, { x: 0.34, y: 0.62 }],
      [{ x: 0, y: 0.68 }, { x: 0.32, y: 0.65 }, { x: 0.35, y: 0.98 }, { x: 0, y: 1 }],
      [{ x: 0.37, y: 0.66 }, { x: 0.68, y: 0.65 }, { x: 0.65, y: 1 }, { x: 0.38, y: 1 }]
    ],
    portrait: [
      [{ x: 0, y: 0.04 }, { x: 0.34, y: 0.03 }, { x: 0.35, y: 0.25 }, { x: 0, y: 0.27 }],
      [{ x: 0, y: 0.3 }, { x: 0.35, y: 0.28 }, { x: 0.36, y: 0.51 }, { x: 0, y: 0.54 }],
      [{ x: 0, y: 0.57 }, { x: 0.43, y: 0.54 }, { x: 0.46, y: 0.75 }, { x: 0, y: 0.77 }],
      [{ x: 0.48, y: 0.56 }, { x: 1, y: 0.54 }, { x: 1, y: 0.75 }, { x: 0.5, y: 0.76 }],
      [{ x: 0, y: 0.8 }, { x: 0.48, y: 0.78 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0.53, y: 0.79 }, { x: 1, y: 0.77 }, { x: 1, y: 1 }, { x: 0.55, y: 1 }]
    ],
    square: [
      [{ x: 0, y: 0.04 }, { x: 0.31, y: 0.03 }, { x: 0.33, y: 0.31 }, { x: 0, y: 0.34 }],
      [{ x: 0, y: 0.38 }, { x: 0.35, y: 0.35 }, { x: 0.37, y: 0.62 }, { x: 0, y: 0.65 }],
      [{ x: 0, y: 0.68 }, { x: 0.4, y: 0.66 }, { x: 0.42, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0.44, y: 0.66 }, { x: 0.72, y: 0.64 }, { x: 0.72, y: 1 }, { x: 0.45, y: 1 }],
      [{ x: 0.74, y: 0.64 }, { x: 1, y: 0.62 }, { x: 1, y: 1 }, { x: 0.75, y: 1 }]
    ]
  };
  return specs[variant].map((points) => scalePolygon(points, width, height));
}

function createTreeBelt(
  width: number,
  height: number,
  unit: number,
  scoreHud: HudExclusionZone
): GatewayTree[] {
  const upperBeltY = Math.max(height * 0.16, scoreHud.height + unit * 0.045);
  return Array.from({ length: 34 }, (_, index) => {
    const lowerBelt = index >= 17;
    const progress = (index % 17) / 16;
    return {
      center: {
        x: width * (0.035 + progress * (lowerBelt ? 0.32 : 0.39))
          + (deterministicUnit(index, 211) - 0.5) * unit * 0.018,
        y: lowerBelt ? height * 0.94 : upperBeltY
          + (deterministicUnit(index, 223) - 0.5) * unit * 0.025
      },
      radius: unit * (0.006 + deterministicUnit(index, 227) * 0.006)
    };
  });
}

export function createSaltmarshGatewayLayout(
  width: number,
  height: number
): SaltmarshGatewayLayout {
  const variant = selectVariant(width, height);
  const profile = PROFILES[variant];
  const unit = Math.min(width, height);
  const main = createRunway(
    'gateway-main',
    'liner',
    ['08', '26'],
    'gateway-liner-zone',
    profile.main,
    width,
    height,
    unit
  );
  const commuter = createRunway(
    'gateway-commuter',
    'commuter',
    ['13', '31'],
    'gateway-commuter-zone',
    profile.commuter,
    width,
    height,
    unit
  );
  const runways = [main, commuter] as const;
  const apron = scalePolygon(profile.apron, width, height);
  const helipad = {
    center: scalePoint(profile.helipad, width, height),
    radius: unit * 0.046,
    zoneId: 'gateway-rotor-zone'
  };
  const taxiwayWidth = Math.max(10, unit * 0.018);
  const taxiways: readonly MapTaxiway<GatewayTaxiwayId, GatewayConnectionId>[] = [
    {
      id: 'gateway-alpha',
      path: [runwayPoint(main, -main.length * 0.04), interpolate(apron[0], apron[1], 0.35)],
      width: taxiwayWidth,
      connects: ['gateway-main', 'gateway-apron']
    },
    {
      id: 'gateway-bravo',
      path: [runwayPoint(commuter, -commuter.length * 0.1), interpolate(apron[2], apron[3], 0.42)],
      width: taxiwayWidth * 0.9,
      connects: ['gateway-commuter', 'gateway-apron']
    },
    {
      id: 'gateway-pad-link',
      path: [interpolate(apron[4], apron[5], 0.45), helipad.center],
      width: taxiwayWidth * 0.78,
      connects: ['gateway-apron', 'gateway-helipad']
    }
  ];
  const captureScale = Math.max(0.86, Math.min(1.18, unit / 900));
  const hudExclusionZones = hudExclusions(width, height);
  const landingZones: LandingZone[] = [
    {
      id: main.zoneId,
      label: '08',
      accepts: 'liner',
      position: runwayPoint(main, main.length * profile.main.landingAlong),
      angle: main.angle,
      captureRadius: 43 * captureScale,
      color: AIRCRAFT_COLORS.liner
    },
    {
      id: commuter.zoneId,
      label: '13',
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
  const buildingUnit = unit;
  const buildingCenters = profile.buildingAnchors.map((point) => scalePoint(point, width, height));
  const buildings: MapBuilding[] = [
    {
      id: 'gateway-terminal',
      center: buildingCenters[0],
      width: buildingUnit * 0.15,
      height: buildingUnit * 0.038,
      angle: main.angle,
      kind: 'terminal'
    },
    {
      id: 'gateway-hangar',
      center: buildingCenters[1],
      width: buildingUnit * 0.085,
      height: buildingUnit * 0.055,
      angle: main.angle,
      kind: 'hangar'
    },
    {
      id: 'gateway-operations',
      center: buildingCenters[2],
      width: buildingUnit * 0.058,
      height: buildingUnit * 0.048,
      angle: commuter.angle,
      kind: 'operations'
    }
  ];
  const holdShortMarkers: readonly HoldShortMarker<GatewayRunwayId, GatewayTaxiwayId>[] = [
    {
      id: 'gateway-hold-alpha',
      position: taxiways[0].path[0],
      angle: main.angle + Math.PI / 2,
      width: taxiwayWidth * 1.5,
      runwayId: main.id,
      taxiwayId: taxiways[0].id
    },
    {
      id: 'gateway-hold-bravo',
      position: taxiways[1].path[0],
      angle: commuter.angle + Math.PI / 2,
      width: taxiwayWidth * 1.4,
      runwayId: commuter.id,
      taxiwayId: taxiways[1].id
    }
  ];
  const parkingStands: ParkingStand[] = [0.22, 0.5, 0.78].map((progress, index) => ({
    id: `gateway-stand-${index + 1}`,
    label: `G${index + 1}`,
    position: interpolate(apron[1], apron[3], progress),
    angle: main.angle + Math.PI / 2,
    length: unit * 0.043
  }));
  const propAnchors: AirfieldPropAnchor[] = [
    {
      id: 'gateway-terminal-anchor',
      kind: 'service',
      label: 'TERMINAL',
      position: buildings[0].center,
      angle: buildings[0].angle,
      size: buildings[0].width
    },
    {
      id: 'gateway-hangar-anchor',
      kind: 'hangar',
      label: 'HANGAR',
      position: buildings[1].center,
      angle: buildings[1].angle,
      size: buildings[1].width
    },
    {
      id: 'gateway-windsock',
      kind: 'windsock',
      label: 'WIND',
      position: interpolate(apron[3], apron[4], 0.45),
      angle: main.angle,
      size: unit * 0.024
    }
  ];
  const signs: AirfieldSign[] = [
    {
      id: 'gateway-sign-alpha',
      kind: 'taxiway',
      label: 'A',
      position: interpolate(taxiways[0].path[0], taxiways[0].path[1], 0.7),
      angle: main.angle
    },
    {
      id: 'gateway-sign-bravo',
      kind: 'taxiway',
      label: 'B',
      position: interpolate(taxiways[1].path[0], taxiways[1].path[1], 0.7),
      angle: commuter.angle
    }
  ];

  return {
    width,
    height,
    variant,
    landingZones,
    guidanceSurfaces: createAirfieldGuidanceSurfaces({ runways, helipad }),
    hudExclusionZones,
    runways,
    taxiways,
    holdShortMarkers,
    parkingStands,
    propAnchors,
    signs,
    helipad,
    apron,
    openAirspace: {
      x: 0,
      y: height * profile.openAirspaceStart,
      width,
      height: height * (1 - profile.openAirspaceStart)
    },
    fieldPolygons: fieldPolygons(width, height, variant),
    tidalPools: profile.poolAnchors.map((anchor, index) =>
      irregularPool(anchor, width, height, unit, index)
    ),
    treeBelt: createTreeBelt(width, height, unit, hudExclusionZones[0]),
    serviceRoads: [
      [scalePoint({ x: 0.48, y: 0.08 }, width, height), apron[0]],
      [apron[3], scalePoint({ x: 0.95, y: 0.59 }, width, height)]
    ],
    buildings,
    routeHaloColor: 0x101e1b
  };
}
