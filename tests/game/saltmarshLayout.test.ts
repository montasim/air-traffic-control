import { describe, expect, it } from 'vitest';
import {
  createSaltmarshLayout,
  type HudExclusionZone,
  type MapRunway,
  type SaltmarshLayout
} from '../../src/game/maps/saltmarsh';
import type { Vector2 } from '../../src/core/types';

const VIEWPORTS = [
  {
    width: 900,
    height: 1600,
    variant: 'portrait',
    main: { centerX: 0.54, centerY: 0.225, length: 0.84, width: 0.054, angle: 0.03 },
    crosswind: { centerX: 0.69, centerY: 0.315, length: 0.62, width: 0.044, angle: -0.82 }
  },
  {
    width: 1600,
    height: 900,
    variant: 'landscape',
    main: { centerX: 0.735, centerY: 0.27, length: 0.86, width: 0.05, angle: 0.08 },
    crosswind: { centerX: 0.785, centerY: 0.43, length: 0.64, width: 0.041, angle: -0.78 }
  },
  {
    width: 900,
    height: 900,
    variant: 'square',
    main: { centerX: 0.55, centerY: 0.28, length: 0.8, width: 0.05, angle: 0.06 },
    crosswind: { centerX: 0.67, centerY: 0.42, length: 0.6, width: 0.041, angle: -0.8 }
  }
] as const;

function isInBounds(point: Vector2, layout: SaltmarshLayout): boolean {
  return point.x >= 0 && point.x <= layout.width && point.y >= 0 && point.y <= layout.height;
}

function isInsideExclusion(point: Vector2, exclusion: HudExclusionZone): boolean {
  return point.x >= exclusion.x &&
    point.x <= exclusion.x + exclusion.width &&
    point.y >= exclusion.y &&
    point.y <= exclusion.y + exclusion.height;
}

function detailPoints(layout: SaltmarshLayout): Vector2[] {
  return [
    ...layout.taxiways.flatMap((taxiway) => taxiway.path),
    ...layout.holdShortMarkers.map((marker) => marker.position),
    ...layout.parkingStands.map((stand) => stand.position),
    ...layout.propAnchors.map((prop) => prop.position),
    ...layout.signs.map((sign) => sign.position)
  ];
}

function runwayCoordinates(runway: MapRunway, point: Vector2): { along: number; across: number } {
  const offsetX = point.x - runway.center.x;
  const offsetY = point.y - runway.center.y;
  return {
    along: offsetX * Math.cos(runway.angle) + offsetY * Math.sin(runway.angle),
    across: offsetX * -Math.sin(runway.angle) + offsetY * Math.cos(runway.angle)
  };
}

function runwayCorners(runway: MapRunway): Vector2[] {
  const forward = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
  const right = { x: -forward.y, y: forward.x };
  const halfLength = runway.length / 2;
  const halfWidth = runway.width / 2;

  return [-1, 1].flatMap((alongSign) => [-1, 1].map((acrossSign) => ({
    x: runway.center.x + forward.x * halfLength * alongSign + right.x * halfWidth * acrossSign,
    y: runway.center.y + forward.y * halfLength * alongSign + right.y * halfWidth * acrossSign
  })));
}

function runwayIntersection(first: MapRunway, second: MapRunway): {
  point: Vector2;
  firstAlong: number;
  secondAlong: number;
} {
  const firstDirection = { x: Math.cos(first.angle), y: Math.sin(first.angle) };
  const secondDirection = { x: Math.cos(second.angle), y: Math.sin(second.angle) };
  const delta = {
    x: second.center.x - first.center.x,
    y: second.center.y - first.center.y
  };
  const denominator = firstDirection.x * secondDirection.y -
    firstDirection.y * secondDirection.x;
  const firstAlong = (delta.x * secondDirection.y - delta.y * secondDirection.x) /
    denominator;
  const secondAlong = (delta.x * firstDirection.y - delta.y * firstDirection.x) /
    denominator;

  return {
    point: {
      x: first.center.x + firstDirection.x * firstAlong,
      y: first.center.y + firstDirection.y * firstAlong
    },
    firstAlong,
    secondAlong
  };
}

function pointToSegmentDistance(point: Vector2, start: Vector2, end: Vector2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.y - (start.y + dy * progress)
  );
}

function distanceToPath(point: Vector2, path: readonly Vector2[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    minimum = Math.min(minimum, pointToSegmentDistance(point, path[index], path[index + 1]));
  }
  return minimum;
}

describe('Saltmarsh airfield layout', () => {
  it.each(VIEWPORTS)('uses the approved operational runway proportions in $variant', ({
    width,
    height,
    main,
    crosswind
  }) => {
    const layout = createSaltmarshLayout(width, height);
    const unit = Math.min(width, height);
    const mainRunway = layout.runways.find((runway) => runway.id === 'long-runway')!;
    const crosswindRunway = layout.runways.find((runway) => runway.id === 'crosswind-strip')!;

    expect(mainRunway.center.x).toBeCloseTo(width * main.centerX, 8);
    expect(mainRunway.center.y).toBeCloseTo(height * main.centerY, 8);
    expect(mainRunway.length).toBeCloseTo(unit * main.length, 8);
    expect(mainRunway.width).toBeCloseTo(unit * main.width, 8);
    expect(mainRunway.angle).toBe(main.angle);
    expect(mainRunway.length / mainRunway.width).toBeGreaterThanOrEqual(15.5);
    expect(mainRunway.length / mainRunway.width).toBeLessThanOrEqual(17.5);

    expect(crosswindRunway.center.x).toBeCloseTo(width * crosswind.centerX, 8);
    expect(crosswindRunway.center.y).toBeCloseTo(height * crosswind.centerY, 8);
    expect(crosswindRunway.length).toBeCloseTo(unit * crosswind.length, 8);
    expect(crosswindRunway.width).toBeCloseTo(unit * crosswind.width, 8);
    expect(crosswindRunway.angle).toBe(crosswind.angle);
    expect(crosswindRunway.length / crosswindRunway.width).toBeGreaterThanOrEqual(14);
    expect(crosswindRunway.length / crosswindRunway.width).toBeLessThanOrEqual(16);

    for (const runway of layout.runways) {
      for (const corner of runwayCorners(runway)) expect(isInBounds(corner, layout)).toBe(true);
    }
  });

  it.each(VIEWPORTS)('uses reciprocal runway designators in $variant', ({ width, height }) => {
    const layout = createSaltmarshLayout(width, height);
    expect(layout.runways.map((runway) => [runway.id, ...runway.designators])).toEqual([
      ['long-runway', '09', '27'],
      ['crosswind-strip', '32', '14']
    ]);
  });

  it.each(VIEWPORTS)('keeps landing zones authoritative and aligned to their surfaces in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshLayout(width, height);
    expect(layout.landingZones.map(({ id, accepts, captureRadius }) => ({
      id,
      accepts,
      captureRadius
    }))).toEqual([
      { id: 'runway-main', accepts: 'liner', captureRadius: 43 },
      { id: 'runway-crosswind', accepts: 'commuter', captureRadius: 39 },
      { id: 'helipad', accepts: 'rotor', captureRadius: 41 }
    ]);

    for (const [runwayIndex, landingAlong] of [-0.37, -0.35].entries()) {
      const runway = layout.runways[runwayIndex];
      const zone = layout.landingZones.find((candidate) => candidate.id === runway.zoneId)!;
      const local = runwayCoordinates(runway, zone.position);
      expect(local.along).toBeCloseTo(runway.length * landingAlong, 8);
      expect(local.across).toBeCloseTo(0, 8);
      expect(zone.angle).toBe(runway.angle);
      expect(isInBounds(zone.position, layout)).toBe(true);
      expect(zone.position.x - zone.captureRadius).toBeGreaterThanOrEqual(0);
      expect(zone.position.x + zone.captureRadius).toBeLessThanOrEqual(width);
      expect(zone.position.y - zone.captureRadius).toBeGreaterThanOrEqual(0);
      expect(zone.position.y + zone.captureRadius).toBeLessThanOrEqual(height);
      expect(layout.hudExclusionZones.some((hud) => isInsideExclusion(zone.position, hud))).toBe(false);
    }

    expect(layout.helipad.center).toEqual(
      layout.landingZones.find((zone) => zone.id === layout.helipad.zoneId)?.position
    );
  });

  it.each(VIEWPORTS)('intersects both runways away from their thresholds in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshLayout(width, height);
    const [main, crosswind] = layout.runways;
    const intersection = runwayIntersection(main, crosswind);
    const clearance = Math.max(main.width, crosswind.width) * 1.5;

    expect(isInBounds(intersection.point, layout)).toBe(true);
    expect(Math.abs(intersection.firstAlong)).toBeLessThan(main.length / 2 - clearance);
    expect(Math.abs(intersection.secondAlong)).toBeLessThan(crosswind.length / 2 - clearance);
    expect(runwayCoordinates(main, intersection.point).across).toBeCloseTo(0, 8);
    expect(runwayCoordinates(crosswind, intersection.point).across).toBeCloseTo(0, 8);
  });

  it.each(VIEWPORTS)('keeps all airfield detail anchors in bounds and clear of the HUD in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshLayout(width, height);

    for (const point of detailPoints(layout)) {
      expect(isInBounds(point, layout)).toBe(true);
      expect(layout.hudExclusionZones.some((zone) => isInsideExclusion(point, zone))).toBe(false);
      expect(point.x).toBeGreaterThan(width * 0.38);
      expect(point.y).toBeLessThan(height * 0.68);
    }
  });

  it.each(VIEWPORTS)('connects taxiways to declared surfaces with valid hold-short anchors in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshLayout(width, height);
    expect(layout.taxiways.map((taxiway) => taxiway.connects)).toEqual([
      ['long-runway', 'apron'],
      ['crosswind-strip', 'apron'],
      ['apron', 'helipad']
    ]);

    for (const marker of layout.holdShortMarkers) {
      const taxiway = layout.taxiways.find((candidate) => candidate.id === marker.taxiwayId);
      const runway = layout.runways.find((candidate) => candidate.id === marker.runwayId);
      expect(taxiway).toBeDefined();
      expect(runway).toBeDefined();
      expect(taxiway?.connects).toContain(marker.runwayId);
      expect(marker.width).toBeGreaterThan(taxiway?.width ?? 0);
      expect(distanceToPath(marker.position, taxiway!.path)).toBeLessThan(1e-7);

      const local = runwayCoordinates(runway!, marker.position);
      const clearance = runway!.width / 2 + taxiway!.width / 2 + 2;
      expect(Math.abs(local.across)).toBeCloseTo(clearance, 8);
      expect(Math.abs(local.along)).toBeLessThan(runway!.length / 2);
    }

    for (const taxiway of layout.taxiways.slice(0, 2)) {
      const runway = layout.runways.find((candidate) => candidate.id === taxiway.connects[0]);
      expect(runway).toBeDefined();
      const start = taxiway.path[0];
      const offsetX = start.x - runway!.center.x;
      const offsetY = start.y - runway!.center.y;
      const crossTrack = Math.abs(
        offsetX * -Math.sin(runway!.angle) + offsetY * Math.cos(runway!.angle)
      );
      const alongTrack = Math.abs(
        offsetX * Math.cos(runway!.angle) + offsetY * Math.sin(runway!.angle)
      );
      expect(crossTrack).toBeLessThan(1e-8);
      expect(alongTrack).toBeLessThan(runway!.length / 2);
    }

    const helipadTaxiway = layout.taxiways.find((taxiway) => taxiway.id === 'taxiway-helipad');
    expect(helipadTaxiway?.path[helipadTaxiway.path.length - 1]).toEqual(layout.helipad.center);
  });

  it.each(VIEWPORTS)('provides deterministic, unique props and facility labels in $variant', ({
    width,
    height
  }) => {
    const first = createSaltmarshLayout(width, height);
    const second = createSaltmarshLayout(width, height);
    expect(second).toEqual(first);

    expect(new Set(first.propAnchors.map((prop) => prop.id)).size).toBe(first.propAnchors.length);
    expect(first.propAnchors.map((prop) => prop.kind)).toEqual([
      'windsock',
      'hangar',
      'service',
      'fuel',
      'fence',
      'utility'
    ]);
    expect(first.signs.map((sign) => sign.label)).toEqual(['A', 'B', 'FUEL', 'OPS']);
  });
});
