import type { AircraftType, LandingZone, Vector2 } from '../../../core/types';
import type { WorldDetailLevel } from '../../palette';
import type {
  AirfieldPropAnchor,
  AirfieldSign,
  MapRunway,
  MapTaxiway,
  ParkingStand
} from '../shared/airfield';
import { createAirfieldGuidanceSurfaces } from '../shared/guidance';
import type { HudExclusionZone, MapLayoutVariant, PlayableMapLayout } from '../types';

export type TwinBanksRunwayId = 'east-main' | 'west-commuter';
export type TwinBanksTaxiwayId = 'east-link' | 'west-link' | 'east-pad-link';
export type TwinBanksConnectionId = TwinBanksRunwayId | 'east-apron' | 'west-apron' | 'helipad';

export interface TwinBanksRoutingArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RiverGeometry {
  readonly centerline: readonly Vector2[];
  readonly width: number;
  readonly shelfWidth: number;
}

export interface ScenicRunway {
  readonly id: string;
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly designators: readonly [string, string];
}

export interface RiverBridge {
  readonly id: string;
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
}

export interface TwinBanksDetailBudget {
  readonly fieldBands: number;
  readonly trees: number;
  readonly riverMarks: number;
  readonly serviceProps: number;
  readonly showLabels: boolean;
}

export interface BankDecoration {
  readonly id: string;
  readonly kind: 'field' | 'tree' | 'river-mark';
  readonly position: Vector2;
  readonly angle: number;
  readonly scale: number;
}

export const TWIN_BANKS_DETAIL_BUDGETS: Record<WorldDetailLevel, TwinBanksDetailBudget> = {
  mobile: { fieldBands: 8, trees: 12, riverMarks: 6, serviceProps: 3, showLabels: false },
  tablet: { fieldBands: 14, trees: 22, riverMarks: 10, serviceProps: 5, showLabels: true },
  desktop: { fieldBands: 22, trees: 34, riverMarks: 16, serviceProps: 7, showLabels: true }
};

export const TWIN_BANKS_PALETTE = {
  westGround: 0xb2a477,
  westHigh: 0x8b7954,
  eastGround: 0x829b6e,
  eastHigh: 0xa6b883,
  fieldLine: 0x9a8d67,
  tree: 0x688357,
  riverDeep: 0x6c949c,
  riverMid: 0x8eb4b7,
  riverShelf: 0xc2c5a2,
  bridge: 0x77776b,
  apron: 0x3c4742,
  runway: 0x26302e,
  scenicRunway: 0x4d5149,
  runwayShoulder: 0x56625a,
  runwayMarking: 0xe3dfcf,
  taxiwayMarking: 0xb49a59,
  buildingWall: 0x596159,
  buildingRoof: 0x303a37,
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

interface TwinBanksProfile {
  readonly east: NormalizedRunway;
  readonly west: NormalizedRunway;
  readonly scenic: Omit<NormalizedRunway, 'landingAlong'>;
  readonly helipad: Vector2;
  readonly eastApron: readonly Vector2[];
  readonly westApron: readonly Vector2[];
  readonly river: readonly Vector2[];
  readonly routingArea: TwinBanksRoutingArea;
}

const PROFILES: Record<MapLayoutVariant, TwinBanksProfile> = {
  landscape: {
    east: { center: { x: 0.735, y: 0.25 }, length: 0.76, width: 0.05, angle: 0.09, landingAlong: -0.36 },
    west: { center: { x: 0.25, y: 0.39 }, length: 0.58, width: 0.043, angle: -0.13, landingAlong: -0.34 },
    scenic: { center: { x: 0.25, y: 0.25 }, length: 0.44, width: 0.032, angle: -0.13 },
    helipad: { x: 0.81, y: 0.48 },
    eastApron: [{ x: 0.65, y: 0.31 }, { x: 0.83, y: 0.32 }, { x: 0.88, y: 0.51 }, { x: 0.7, y: 0.56 }, { x: 0.63, y: 0.43 }],
    westApron: [{ x: 0.12, y: 0.31 }, { x: 0.33, y: 0.29 }, { x: 0.39, y: 0.48 }, { x: 0.18, y: 0.54 }, { x: 0.1, y: 0.44 }],
    river: [{ x: 0.47, y: -0.05 }, { x: 0.5, y: 0.18 }, { x: 0.46, y: 0.4 }, { x: 0.51, y: 0.63 }, { x: 0.48, y: 1.05 }],
    routingArea: { x: 0, y: 0.61, width: 1, height: 0.39 }
  },
  portrait: {
    east: { center: { x: 0.68, y: 0.25 }, length: 0.75, width: 0.052, angle: 1.5, landingAlong: -0.36 },
    west: { center: { x: 0.25, y: 0.34 }, length: 0.58, width: 0.044, angle: 1.62, landingAlong: -0.34 },
    scenic: { center: { x: 0.1, y: 0.34 }, length: 0.41, width: 0.032, angle: 1.62 },
    helipad: { x: 0.83, y: 0.48 },
    eastApron: [{ x: 0.64, y: 0.25 }, { x: 0.89, y: 0.24 }, { x: 0.91, y: 0.48 }, { x: 0.7, y: 0.53 }, { x: 0.61, y: 0.4 }],
    westApron: [{ x: 0.05, y: 0.28 }, { x: 0.37, y: 0.25 }, { x: 0.42, y: 0.45 }, { x: 0.15, y: 0.51 }, { x: 0.04, y: 0.42 }],
    river: [{ x: 0.49, y: -0.05 }, { x: 0.52, y: 0.18 }, { x: 0.47, y: 0.4 }, { x: 0.53, y: 0.65 }, { x: 0.5, y: 1.05 }],
    routingArea: { x: 0, y: 0.6, width: 1, height: 0.4 }
  },
  square: {
    east: { center: { x: 0.72, y: 0.3 }, length: 0.56, width: 0.05, angle: 1.4, landingAlong: -0.36 },
    west: { center: { x: 0.28, y: 0.38 }, length: 0.52, width: 0.043, angle: 1.7, landingAlong: -0.34 },
    scenic: { center: { x: 0.12, y: 0.38 }, length: 0.36, width: 0.032, angle: 1.7 },
    helipad: { x: 0.89, y: 0.50 },
    eastApron: [{ x: 0.63, y: 0.31 }, { x: 0.84, y: 0.31 }, { x: 0.9, y: 0.5 }, { x: 0.7, y: 0.56 }, { x: 0.61, y: 0.43 }],
    westApron: [{ x: 0.1, y: 0.32 }, { x: 0.35, y: 0.29 }, { x: 0.41, y: 0.49 }, { x: 0.17, y: 0.55 }, { x: 0.08, y: 0.45 }],
    river: [{ x: 0.48, y: -0.05 }, { x: 0.51, y: 0.18 }, { x: 0.46, y: 0.4 }, { x: 0.52, y: 0.65 }, { x: 0.49, y: 1.05 }],
    routingArea: { x: 0, y: 0.62, width: 1, height: 0.38 }
  }
};

export interface TwinBanksLayout extends PlayableMapLayout {
  readonly runways: readonly MapRunway<TwinBanksRunwayId, string>[];
  readonly taxiways: readonly MapTaxiway<TwinBanksTaxiwayId, TwinBanksConnectionId>[];
  readonly holdShortMarkers: readonly [];
  readonly parkingStands: readonly ParkingStand[];
  readonly propAnchors: readonly AirfieldPropAnchor[];
  readonly signs: readonly AirfieldSign[];
  readonly helipad: { readonly center: Vector2; readonly radius: number; readonly zoneId: string };
  readonly apron: readonly Vector2[];
  readonly westApron: readonly Vector2[];
  readonly river: RiverGeometry;
  readonly scenicRunways: readonly ScenicRunway[];
  readonly bridges: readonly RiverBridge[];
  readonly decorations: readonly BankDecoration[];
  readonly routingArea: TwinBanksRoutingArea;
  readonly detailBudget: TwinBanksDetailBudget;
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
  along: number
): Vector2 => ({
  x: runway.center.x + Math.cos(runway.angle) * along,
  y: runway.center.y + Math.sin(runway.angle) * along
});

function runway(
  id: TwinBanksRunwayId,
  accepts: Exclude<AircraftType, 'rotor'>,
  spec: NormalizedRunway,
  width: number,
  height: number,
  unit: number,
  designators: readonly [string, string],
  zoneId: string
): MapRunway<TwinBanksRunwayId, string> {
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
  const value = Math.sin((index + 1) * 73.137 + salt * 41.219) * 27531.417;
  return value - Math.floor(value);
}

function createDecorations(
  width: number,
  height: number,
  budget: TwinBanksDetailBudget
): BankDecoration[] {
  const groups: readonly [BankDecoration['kind'], number, number][] = [
    ['field', budget.fieldBands, 2],
    ['tree', budget.trees, 7],
    ['river-mark', budget.riverMarks, 13]
  ];
  return groups.flatMap(([kind, count, salt]) => Array.from({ length: count }, (_, index) => {
    const bankBias = deterministicUnit(index, salt) < 0.5 ? 0.05 : 0.56;
    const bankWidth = kind === 'river-mark' ? 0.08 : 0.36;
    return {
      id: `${kind}-${index + 1}`,
      kind,
      position: {
        x: width * (kind === 'river-mark'
          ? 0.45 + deterministicUnit(index, salt + 1) * bankWidth
          : bankBias + deterministicUnit(index, salt + 1) * bankWidth),
        y: height * (0.23 + deterministicUnit(index, salt + 2) * 0.34)
      },
      angle: (deterministicUnit(index, salt + 3) - 0.5) * 0.7,
      scale: 0.65 + deterministicUnit(index, salt + 4) * 0.8
    };
  }));
}

export function createTwinBanksLayout(
  width: number,
  height: number,
  detailLevel: WorldDetailLevel = 'desktop'
): TwinBanksLayout {
  const variant = variantFor(width, height);
  const profile = PROFILES[variant];
  const unit = Math.min(width, height);
  const budget = TWIN_BANKS_DETAIL_BUDGETS[detailLevel];
  const east = runway(
    'east-main', 'liner', profile.east, width, height, unit, ['06', '24'], 'twin-liner'
  );
  const west = runway(
    'west-commuter', 'commuter', profile.west, width, height, unit, ['11', '29'], 'twin-commuter'
  );
  const runways = [east, west] as const;
  const eastApron = profile.eastApron.map((point) => scalePoint(point, width, height));
  const westApron = profile.westApron.map((point) => scalePoint(point, width, height));
  const helipadCenter = scalePoint(profile.helipad, width, height);
  const helipad = { center: helipadCenter, radius: unit * 0.052, zoneId: 'twin-helipad' };
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));
  const landingZones: LandingZone[] = [
    {
      id: east.zoneId,
      label: east.designators[0],
      accepts: 'liner',
      position: pointOnRunway(east, east.length * profile.east.landingAlong),
      angle: east.angle,
      captureRadius: 43 * captureScale,
      color: TWIN_BANKS_PALETTE.liner
    },
    {
      id: west.zoneId,
      label: west.designators[0],
      accepts: 'commuter',
      position: pointOnRunway(west, west.length * profile.west.landingAlong),
      angle: west.angle,
      captureRadius: 39 * captureScale,
      color: TWIN_BANKS_PALETTE.commuter
    },
    {
      id: helipad.zoneId,
      label: 'H',
      accepts: 'rotor',
      position: helipad.center,
      angle: 0,
      captureRadius: 41 * captureScale,
      color: TWIN_BANKS_PALETTE.rotor
    }
  ];
  const eastCenter = scalePoint({ x: 0.76, y: variant === 'portrait' ? 0.38 : 0.4 }, width, height);
  const westCenter = scalePoint({ x: 0.23, y: variant === 'portrait' ? 0.4 : 0.42 }, width, height);
  const taxiwayWidth = Math.max(10, unit * 0.016);
  const taxiways: readonly MapTaxiway<TwinBanksTaxiwayId, TwinBanksConnectionId>[] = [
    {
      id: 'east-link',
      path: [pointOnRunway(east, east.length * 0.1), interpolate(east.center, eastCenter, 0.62), eastCenter],
      width: taxiwayWidth,
      connects: ['east-main', 'east-apron']
    },
    {
      id: 'west-link',
      path: [pointOnRunway(west, west.length * 0.08), interpolate(west.center, westCenter, 0.58), westCenter],
      width: taxiwayWidth * 0.88,
      connects: ['west-commuter', 'west-apron']
    },
    {
      id: 'east-pad-link',
      path: [eastCenter, interpolate(eastCenter, helipadCenter, 0.55), helipadCenter],
      width: taxiwayWidth * 0.74,
      connects: ['east-apron', 'helipad']
    }
  ];
  const scenicSpec = profile.scenic;
  const scenicRunways: readonly ScenicRunway[] = [{
    id: 'west-relief-strip',
    center: scalePoint(scenicSpec.center, width, height),
    length: scenicSpec.length * unit,
    width: scenicSpec.width * unit,
    angle: scenicSpec.angle,
    designators: ['04', '22']
  }];
  const river: RiverGeometry = {
    centerline: profile.river.map((point) => scalePoint(point, width, height)),
    width: unit * 0.08,
    shelfWidth: unit * 0.116
  };
  const bridgeCenter = interpolate(river.centerline[2], river.centerline[3], 0.24);
  const riverAngle = Math.atan2(
    river.centerline[3].y - river.centerline[2].y,
    river.centerline[3].x - river.centerline[2].x
  );
  const bridges: readonly RiverBridge[] = [{
    id: 'service-bridge',
    center: bridgeCenter,
    length: river.shelfWidth * 1.3,
    width: unit * 0.022,
    angle: riverAngle + Math.PI / 2
  }];
  const parkingStands: readonly ParkingStand[] = [
    { id: 'east-stand-1', label: 'E1', position: interpolate(eastApron[0], eastApron[1], 0.36), angle: east.angle + Math.PI / 2, length: unit * 0.043 },
    { id: 'east-stand-2', label: 'E2', position: interpolate(eastApron[0], eastApron[1], 0.68), angle: east.angle + Math.PI / 2, length: unit * 0.043 },
    { id: 'west-stand-1', label: 'W1', position: interpolate(westApron[0], westApron[1], 0.5), angle: west.angle + Math.PI / 2, length: unit * 0.038 }
  ];
  const allProps: readonly AirfieldPropAnchor[] = [
    { id: 'east-ops', kind: 'service', label: 'EAST OPS', position: eastCenter, angle: east.angle, size: unit * 0.066 },
    { id: 'east-hangar', kind: 'hangar', label: 'HANGAR', position: interpolate(eastApron[3], eastCenter, 0.18), angle: east.angle, size: unit * 0.065 },
    { id: 'east-fuel', kind: 'fuel', label: 'FUEL', position: interpolate(eastApron[2], eastCenter, 0.17), angle: east.angle, size: unit * 0.033 },
    { id: 'east-wind', kind: 'windsock', label: 'WIND', position: interpolate(eastApron[4], eastCenter, 0.14), angle: east.angle, size: unit * 0.021 },
    { id: 'west-ops', kind: 'service', label: 'WEST OPS', position: westCenter, angle: west.angle, size: unit * 0.054 },
    { id: 'west-hangar', kind: 'hangar', label: 'HANGAR', position: interpolate(westApron[3], westCenter, 0.18), angle: west.angle, size: unit * 0.056 },
    { id: 'west-utility', kind: 'utility', label: 'UTIL', position: interpolate(westApron[2], westCenter, 0.16), angle: west.angle, size: unit * 0.032 }
  ];
  const propAnchors = allProps.slice(0, budget.serviceProps);
  const signs: readonly AirfieldSign[] = [
    { id: 'east-sign', kind: 'taxiway', label: 'E', position: taxiways[0].path[1], angle: east.angle },
    { id: 'west-sign', kind: 'taxiway', label: 'W', position: taxiways[1].path[1], angle: west.angle },
    { id: 'east-ops-sign', kind: 'facility', label: 'EAST OPS', position: eastCenter, angle: 0 },
    { id: 'west-ops-sign', kind: 'facility', label: 'WEST OPS', position: westCenter, angle: 0 }
  ];
  const routingArea = {
    x: profile.routingArea.x * width,
    y: profile.routingArea.y * height,
    width: profile.routingArea.width * width,
    height: profile.routingArea.height * height
  };

  return {
    width,
    height,
    variant,
    landingZones,
    guidanceSurfaces: createAirfieldGuidanceSurfaces({ runways, helipad }),
    hudExclusionZones: hudExclusions(width, height),
    runways,
    taxiways,
    holdShortMarkers: [],
    parkingStands,
    propAnchors,
    signs,
    helipad,
    apron: eastApron,
    westApron,
    river,
    scenicRunways,
    bridges,
    decorations: createDecorations(width, height, budget),
    routingArea,
    detailBudget: budget
  };
}
