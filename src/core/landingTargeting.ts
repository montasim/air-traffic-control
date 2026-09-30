import type { AircraftType, LandingZone, Vector2 } from './types';

export type PointerPrecision = 'mouse' | 'coarse';

export interface LandingTargetingInput {
  aircraftType: AircraftType;
  aircraftCollisionRadius: number;
  points: readonly Vector2[];
  zones: readonly LandingZone[];
  pointerPrecision: PointerPrecision;
  retainedZoneId?: string;
}

export type LandingTargetingResult =
  | { status: 'neutral' }
  | {
      status: 'locked';
      zoneId: string;
      snappedPoint: Vector2;
      acquisitionRadius: number;
      retentionRadius: number;
    }
  | {
      status: 'invalid';
      zoneId: string;
      acquisitionRadius: number;
    };

const POINTER_FACTORS: Record<PointerPrecision, number> = {
  mouse: 1.4,
  coarse: 1.65
};

const RETENTION_FACTOR = 1.25;

export function landingTargetRadius(
  zone: LandingZone,
  aircraftCollisionRadius: number,
  pointerPrecision: PointerPrecision
): number {
  const interactionUnit = Math.max(zone.captureRadius, aircraftCollisionRadius * 2.5);
  return interactionUnit * POINTER_FACTORS[pointerPrecision];
}

export function resolveLandingTarget({
  aircraftType,
  aircraftCollisionRadius,
  points,
  zones,
  pointerPrecision,
  retainedZoneId
}: LandingTargetingInput): LandingTargetingResult {
  const endpoint = points[points.length - 1];
  if (!endpoint) return { status: 'neutral' };

  const retainedZone = retainedZoneId
    ? zones.find((zone) => zone.id === retainedZoneId && zone.accepts === aircraftType)
    : undefined;

  // An endpoint deliberately placed on another end wins over retention or a crossed segment.
  const direct = zones.filter(zone => zone.accepts === aircraftType)
    .filter(zone => pointDistance(endpoint, zone.position) <= zone.captureRadius)
    .sort((a,b) => pointDistance(endpoint,a.position)-pointDistance(endpoint,b.position))[0];
  if (direct && direct.id !== retainedZone?.id) {
    const radius = landingTargetRadius(direct, aircraftCollisionRadius, pointerPrecision);
    return lockedResult(direct, radius, radius * RETENTION_FACTOR);
  }

  if (retainedZone) {
    const acquisitionRadius = landingTargetRadius(
      retainedZone,
      aircraftCollisionRadius,
      pointerPrecision
    );
    const retentionRadius = acquisitionRadius * RETENTION_FACTOR;
    if (pointDistance(endpoint, retainedZone.position) <= retentionRadius) {
      return lockedResult(retainedZone, acquisitionRadius, retentionRadius);
    }
  }

  const previous = points.length > 1 ? points[points.length - 2] : endpoint;
  const candidates = zones
    .filter((zone) => zone.id !== retainedZone?.id)
    .map((zone) => ({
      zone,
      radius: landingTargetRadius(zone, aircraftCollisionRadius, pointerPrecision),
      endpointDistance: pointDistance(endpoint, zone.position),
      segmentDistance: pointToSegmentDistance(zone.position, previous, endpoint)
    }))
    .filter(({ radius, endpointDistance, segmentDistance }) =>
      endpointDistance <= radius || segmentDistance <= radius
    );

  const compatible = nearestCandidate(
    candidates.filter(({ zone }) => zone.accepts === aircraftType)
  );
  if (compatible) {
    return lockedResult(
      compatible.zone,
      compatible.radius,
      compatible.radius * RETENTION_FACTOR
    );
  }

  const incompatible = nearestCandidate(candidates);
  if (incompatible) {
    return {
      status: 'invalid',
      zoneId: incompatible.zone.id,
      acquisitionRadius: incompatible.radius
    };
  }

  return { status: 'neutral' };
}

function lockedResult(
  zone: LandingZone,
  acquisitionRadius: number,
  retentionRadius: number
): Extract<LandingTargetingResult, { status: 'locked' }> {
  return {
    status: 'locked',
    zoneId: zone.id,
    snappedPoint: { ...zone.position },
    acquisitionRadius,
    retentionRadius
  };
}

function nearestCandidate<T extends { endpointDistance: number; segmentDistance: number }>(
  candidates: readonly T[]
): T | undefined {
  return [...candidates].sort((first, second) => {
    const endpointDifference = first.endpointDistance - second.endpointDistance;
    return endpointDifference !== 0
      ? endpointDifference
      : first.segmentDistance - second.segmentDistance;
  })[0];
}

function pointDistance(first: Vector2, second: Vector2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointToSegmentDistance(point: Vector2, start: Vector2, end: Vector2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return pointDistance(point, start);

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return pointDistance(point, {
    x: start.x + projection * dx,
    y: start.y + projection * dy
  });
}
