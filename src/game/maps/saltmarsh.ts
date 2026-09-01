import type { AircraftType, LandingZone, Vector2 } from '../../core/types';
import type { PlayableMapLayout } from './types';
import type {
  AirfieldLayout,
  AirfieldPropAnchor as SharedAirfieldPropAnchor,
  AirfieldPropKind as SharedAirfieldPropKind,
  AirfieldSign as SharedAirfieldSign,
  HoldShortMarker as SharedHoldShortMarker,
  MapRunway as SharedMapRunway,
  MapTaxiway as SharedMapTaxiway,
  ParkingStand as SharedParkingStand
} from './shared/airfield';
import { createAirfieldGuidanceSurfaces } from './shared/guidance';
import type { HudExclusionZone } from './types';

export type SaltmarshVariant = 'portrait' | 'landscape' | 'square';
export type RunwayId = 'long-runway' | 'crosswind-strip';
export type RunwayDesignator = '09' | '27' | '32' | '14';
export type TaxiwayId = 'taxiway-alpha' | 'taxiway-bravo' | 'taxiway-helipad';
export type AirfieldConnectionId = RunwayId | 'apron' | 'helipad';
export type AirfieldPropKind = SharedAirfieldPropKind;
export type MapRunway = SharedMapRunway<RunwayId, RunwayDesignator>;
export type MapTaxiway = SharedMapTaxiway<TaxiwayId, AirfieldConnectionId>;
export type HoldShortMarker = SharedHoldShortMarker<RunwayId, TaxiwayId>;
export type ParkingStand = SharedParkingStand;
export type AirfieldPropAnchor = SharedAirfieldPropAnchor;
export type AirfieldSign = SharedAirfieldSign;
export type { HudExclusionZone } from './types';

export interface SaltmarshLayout extends
  PlayableMapLayout,
  AirfieldLayout<RunwayId, RunwayDesignator, TaxiwayId, AirfieldConnectionId> {
  width: number;
  height: number;
  variant: SaltmarshVariant;
  landingZones: LandingZone[];
  runways: MapRunway[];
  taxiways: readonly MapTaxiway[];
  holdShortMarkers: readonly HoldShortMarker[];
  parkingStands: readonly ParkingStand[];
  propAnchors: readonly AirfieldPropAnchor[];
  signs: readonly AirfieldSign[];
  helipad: {
    center: Vector2;
    radius: number;
    zoneId: string;
  };
  apron: readonly Vector2[];
  hudExclusionZones: readonly HudExclusionZone[];
}

type RunwayGeometry = Omit<MapRunway, 'zoneId' | 'designators'>;

interface NormalizedRunwaySpec {
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly landingAlong: number;
}

interface AirfieldProfileSpec {
  readonly liner: NormalizedRunwaySpec;
  readonly commuter: NormalizedRunwaySpec;
  readonly helipadCenter: Vector2;
  readonly apron: readonly Vector2[];
}

export const SALTMARSH_COLORS = {
  liner: 0x8bdeda,
  commuter: 0xf0bd66,
  rotor: 0xf0836f,
  marshDeep: 0x263e38,
  marsh: 0x3c5a4f,
  marshLight: 0x526b5d,
  waterDeep: 0x284b54,
  waterShallow: 0x3b6264,
  mudflat: 0x768072,
  sand: 0x9b9675,
  airport: 0x3b4944,
  airportEdge: 0x56635b,
  runway: 0x273431,
  runwayWorn: 0x303d39,
  runwayShoulder: 0x46524d,
  runwayEdge: 0xaab7a8,
  runwayMark: 0xe4e0cc,
  runwayLight: 0xd7ece5,
  taxiway: 0x343f3b,
  taxiwayMark: 0xc8a85e,
  taxiwayLight: 0x6fa9a8,
  utility: 0x667066,
  fence: 0x8b9180,
  serviceRoad: 0x87907c
} as const;

const LANDING_COLORS: Record<AircraftType, number> = {
  liner: SALTMARSH_COLORS.liner,
  commuter: SALTMARSH_COLORS.commuter,
  rotor: SALTMARSH_COLORS.rotor
};

const AIRFIELD_PROFILES: Record<SaltmarshVariant, AirfieldProfileSpec> = {
  landscape: {
    liner: {
      center: { x: 0.735, y: 0.27 },
      length: 0.86,
      width: 0.05,
      angle: 0.08,
      landingAlong: -0.37
    },
    commuter: {
      center: { x: 0.785, y: 0.43 },
      length: 0.64,
      width: 0.041,
      angle: -0.78,
      landingAlong: -0.35
    },
    helipadCenter: { x: 0.655, y: 0.49 },
    apron: [
      { x: 0.62, y: 0.33 },
      { x: 0.75, y: 0.31 },
      { x: 0.84, y: 0.49 },
      { x: 0.68, y: 0.59 },
      { x: 0.6, y: 0.48 }
    ]
  },
  portrait: {
    liner: {
      center: { x: 0.54, y: 0.225 },
      length: 0.84,
      width: 0.054,
      angle: 0.03,
      landingAlong: -0.37
    },
    commuter: {
      center: { x: 0.69, y: 0.315 },
      length: 0.62,
      width: 0.044,
      angle: -0.82,
      landingAlong: -0.35
    },
    helipadCenter: { x: 0.54, y: 0.335 },
    apron: [
      { x: 0.47, y: 0.25 },
      { x: 0.73, y: 0.245 },
      { x: 0.85, y: 0.34 },
      { x: 0.61, y: 0.395 },
      { x: 0.43, y: 0.35 }
    ]
  },
  square: {
    liner: {
      center: { x: 0.55, y: 0.28 },
      length: 0.8,
      width: 0.05,
      angle: 0.06,
      landingAlong: -0.37
    },
    commuter: {
      center: { x: 0.67, y: 0.42 },
      length: 0.6,
      width: 0.041,
      angle: -0.8,
      landingAlong: -0.35
    },
    helipadCenter: { x: 0.55, y: 0.445 },
    apron: [
      { x: 0.49, y: 0.33 },
      { x: 0.72, y: 0.32 },
      { x: 0.84, y: 0.45 },
      { x: 0.61, y: 0.54 },
      { x: 0.47, y: 0.47 }
    ]
  }
};

function selectVariant(width: number, height: number): SaltmarshVariant {
  const aspect = width / height;
  if (aspect >= 1.18) return 'landscape';
  if (aspect <= 0.85) return 'portrait';
  return 'square';
}

function pointOnRunway(runway: RunwayGeometry, distanceFromCenter: number): Vector2 {
  return {
    x: runway.center.x + Math.cos(runway.angle) * distanceFromCenter,
    y: runway.center.y + Math.sin(runway.angle) * distanceFromCenter
  };
}

function runwayFromSpec(
  id: RunwayId,
  accepts: Exclude<AircraftType, 'rotor'>,
  spec: NormalizedRunwaySpec,
  width: number,
  height: number,
  unit: number
): RunwayGeometry {
  return {
    id,
    accepts,
    center: { x: spec.center.x * width, y: spec.center.y * height },
    length: spec.length * unit,
    width: spec.width * unit,
    angle: spec.angle
  };
}

function scalePoint(point: Vector2, width: number, height: number): Vector2 {
  return { x: point.x * width, y: point.y * height };
}

function interpolate(first: Vector2, second: Vector2, progress: number): Vector2 {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress
  };
}

function polygonCenter(points: readonly Vector2[]): Vector2 {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function pathAngle(path: readonly Vector2[]): number {
  const first = path[0];
  const second = path[1] ?? first;
  return Math.atan2(second.y - first.y, second.x - first.x);
}

function taxiwayPath(start: Vector2, end: Vector2, bend: number): readonly Vector2[] {
  const midpoint = interpolate(start, end, 0.52);
  const angle = Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2;
  return [
    start,
    {
      x: midpoint.x + Math.cos(angle) * bend,
      y: midpoint.y + Math.sin(angle) * bend
    },
    end
  ];
}

function crossTrackDistance(runway: RunwayGeometry, point: Vector2): number {
  const offsetX = point.x - runway.center.x;
  const offsetY = point.y - runway.center.y;
  return offsetX * -Math.sin(runway.angle) + offsetY * Math.cos(runway.angle);
}

function holdShortAnchor(
  taxiway: MapTaxiway,
  runway: RunwayGeometry
): Pick<HoldShortMarker, 'position' | 'angle'> {
  const clearance = runway.width / 2 + taxiway.width / 2 + 2;

  for (let index = 0; index < taxiway.path.length - 1; index += 1) {
    const start = taxiway.path[index];
    const end = taxiway.path[index + 1];
    const startAcross = crossTrackDistance(runway, start);
    const endAcross = crossTrackDistance(runway, end);

    if (Math.abs(startAcross) >= clearance) {
      return {
        position: { ...start },
        angle: Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2
      };
    }
    if (Math.abs(endAcross) < clearance) continue;

    const targetAcross = Math.sign(endAcross || 1) * clearance;
    const acrossDelta = endAcross - startAcross;
    if (Math.abs(acrossDelta) < 1e-9) continue;

    const progress = (targetAcross - startAcross) / acrossDelta;
    if (progress < 0 || progress > 1) continue;

    return {
      position: interpolate(start, end, progress),
      angle: Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2
    };
  }

  const end = taxiway.path[taxiway.path.length - 1];
  const previous = taxiway.path[taxiway.path.length - 2] ?? end;
  return {
    position: { ...end },
    angle: Math.atan2(end.y - previous.y, end.x - previous.x) + Math.PI / 2
  };
}

function createAirfieldDetails(
  liner: RunwayGeometry,
  commuter: RunwayGeometry,
  helipadCenter: Vector2,
  apron: readonly Vector2[],
  unit: number
): Pick<
  SaltmarshLayout,
  'taxiways' | 'holdShortMarkers' | 'parkingStands' | 'propAnchors' | 'signs'
> {
  const center = polygonCenter(apron);
  const alphaApron = interpolate(apron[0], center, 0.58);
  // Stay near the outer apron vertex so Bravo clears the crosswind strip
  // before joining the apron in every profile.
  const bravoApron = interpolate(apron[2], center, 0.3);
  const helipadApron = interpolate(apron[4], center, 0.56);
  const taxiwayWidth = Math.max(10, unit * 0.017);

  const taxiways: readonly MapTaxiway[] = [
    {
      id: 'taxiway-alpha',
      path: taxiwayPath(
        pointOnRunway(liner, liner.length * 0.14),
        alphaApron,
        unit * 0.012
      ),
      width: taxiwayWidth,
      connects: ['long-runway', 'apron']
    },
    {
      id: 'taxiway-bravo',
      path: taxiwayPath(
        pointOnRunway(commuter, commuter.length * 0.12),
        bravoApron,
        -unit * 0.01
      ),
      width: taxiwayWidth * 0.9,
      connects: ['crosswind-strip', 'apron']
    },
    {
      id: 'taxiway-helipad',
      path: taxiwayPath(helipadApron, helipadCenter, unit * 0.008),
      width: taxiwayWidth * 0.78,
      connects: ['apron', 'helipad']
    }
  ];

  const runwayById: Record<RunwayId, RunwayGeometry> = {
    'long-runway': liner,
    'crosswind-strip': commuter
  };
  const holdShortMarkers: readonly HoldShortMarker[] = taxiways.flatMap((taxiway) => {
    const connection = taxiway.connects[0];
    if (connection !== 'long-runway' && connection !== 'crosswind-strip') return [];

    return [{
      id: `hold-${taxiway.id}`,
      ...holdShortAnchor(taxiway, runwayById[connection]),
      width: taxiway.width * 1.55,
      runwayId: connection,
      taxiwayId: taxiway.id
    }];
  });

  const parkingStands: readonly ParkingStand[] = [0.2, 0.48, 0.76].map((progress, index) => ({
    id: `stand-${index + 1}`,
    label: `P${index + 1}`,
    position: interpolate(interpolate(apron[0], apron[1], progress), center, 0.34),
    angle: liner.angle + Math.PI / 2,
    length: Math.max(24, unit * 0.044)
  }));

  const propAnchors: readonly AirfieldPropAnchor[] = [
    {
      id: 'windsock-east',
      kind: 'windsock',
      label: 'WIND',
      position: interpolate(apron[3], center, 0.16),
      angle: liner.angle,
      size: unit * 0.024
    },
    {
      id: 'hangar-main',
      kind: 'hangar',
      label: 'HANGAR',
      position: interpolate(apron[0], center, 0.19),
      angle: liner.angle,
      size: unit * 0.082
    },
    {
      id: 'service-building',
      kind: 'service',
      label: 'OPS',
      position: interpolate(apron[4], center, 0.2),
      angle: liner.angle,
      size: unit * 0.052
    },
    {
      id: 'fuel-farm',
      kind: 'fuel',
      label: 'FUEL',
      position: interpolate(apron[2], center, 0.28),
      angle: commuter.angle,
      size: unit * 0.038
    },
    {
      id: 'perimeter-fence',
      kind: 'fence',
      label: 'PERIMETER',
      position: interpolate(apron[1], center, 0.1),
      angle: Math.atan2(apron[2].y - apron[1].y, apron[2].x - apron[1].x),
      size: unit * 0.13
    },
    {
      id: 'utility-yard',
      kind: 'utility',
      label: 'UTIL',
      position: interpolate(apron[3], center, 0.22),
      angle: commuter.angle,
      size: unit * 0.042
    }
  ];

  const alpha = taxiways[0];
  const bravo = taxiways[1];
  const fuel = propAnchors.find((prop) => prop.kind === 'fuel')!;
  const service = propAnchors.find((prop) => prop.kind === 'service')!;
  const signs: readonly AirfieldSign[] = [
    {
      id: 'sign-alpha',
      kind: 'taxiway',
      label: 'A',
      position: interpolate(alpha.path[1], alpha.path[2], 0.7),
      angle: pathAngle(alpha.path)
    },
    {
      id: 'sign-bravo',
      kind: 'taxiway',
      label: 'B',
      position: interpolate(bravo.path[1], bravo.path[2], 0.7),
      angle: pathAngle(bravo.path)
    },
    {
      id: 'sign-fuel',
      kind: 'facility',
      label: fuel.label,
      position: interpolate(fuel.position, center, 0.18),
      angle: fuel.angle
    },
    {
      id: 'sign-ops',
      kind: 'facility',
      label: service.label,
      position: interpolate(service.position, center, 0.18),
      angle: service.angle
    }
  ];

  return { taxiways, holdShortMarkers, parkingStands, propAnchors, signs };
}

function hudZones(width: number, height: number): HudExclusionZone[] {
  const horizontalPad = Math.max(24, width * 0.025);
  const verticalPad = Math.max(24, height * 0.02);
  const labelWidth = Math.min(220, width * 0.28);
  const labelHeight = Math.min(112, height * 0.1);
  const pauseSize = Math.min(112, Math.max(72, Math.min(width, height) * 0.09));

  return [
    { id: 'score', x: 0, y: 0, width: horizontalPad + labelWidth, height: verticalPad + labelHeight },
    {
      id: 'best',
      x: width - horizontalPad - labelWidth,
      y: 0,
      width: horizontalPad + labelWidth,
      height: verticalPad + labelHeight
    },
    {
      id: 'pause',
      x: width - horizontalPad - pauseSize,
      y: height - verticalPad - pauseSize,
      width: horizontalPad + pauseSize,
      height: verticalPad + pauseSize
    }
  ];
}

export function createSaltmarshLayout(width: number, height: number): SaltmarshLayout {
  const variant = selectVariant(width, height);
  const unit = Math.min(width, height);
  const profile = AIRFIELD_PROFILES[variant];
  const liner = runwayFromSpec(
    'long-runway',
    'liner',
    profile.liner,
    width,
    height,
    unit
  );
  const commuter = runwayFromSpec(
    'crosswind-strip',
    'commuter',
    profile.commuter,
    width,
    height,
    unit
  );
  const helipadCenter = scalePoint(profile.helipadCenter, width, height);
  const apron = profile.apron.map((point) => scalePoint(point, width, height));

  const linerZonePosition = pointOnRunway(liner, liner.length * profile.liner.landingAlong);
  const commuterZonePosition = pointOnRunway(
    commuter,
    commuter.length * profile.commuter.landingAlong
  );
  const captureScale = Math.max(0.86, Math.min(1.2, unit / 900));
  const landingZones: LandingZone[] = [
    {
      id: 'runway-main',
      label: '09',
      accepts: 'liner',
      position: linerZonePosition,
      angle: liner.angle,
      captureRadius: 43 * captureScale,
      color: LANDING_COLORS.liner
    },
    {
      id: 'runway-crosswind',
      label: '32',
      accepts: 'commuter',
      position: commuterZonePosition,
      angle: commuter.angle,
      captureRadius: 39 * captureScale,
      color: LANDING_COLORS.commuter
    },
    {
      id: 'helipad',
      label: 'H',
      accepts: 'rotor',
      position: helipadCenter,
      angle: 0,
      captureRadius: 41 * captureScale,
      color: LANDING_COLORS.rotor
    }
  ];
  const details = createAirfieldDetails(liner, commuter, helipadCenter, apron, unit);

  const runways: MapRunway[] = [
    {
      ...liner,
      zoneId: 'runway-main',
      designators: ['09', '27']
    },
    {
      ...commuter,
      zoneId: 'runway-crosswind',
      designators: ['32', '14']
    }
  ];
  const helipad = { center: helipadCenter, radius: unit * 0.055, zoneId: 'helipad' };

  return {
    width,
    height,
    variant,
    landingZones,
    runways,
    ...details,
    helipad,
    apron,
    guidanceSurfaces: createAirfieldGuidanceSurfaces({ runways, helipad }),
    hudExclusionZones: hudZones(width, height)
  };
}
