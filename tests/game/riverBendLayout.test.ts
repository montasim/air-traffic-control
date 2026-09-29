import { ROUTE_OUTLINE_COLOR } from '../../src/game/palette';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { Vector2 } from '../../src/core/types';
import {
  RIVER_BEND_DEFINITION,
  RIVER_BEND_PALETTE,
  createRiverBendLayout,
  type RiverBendLayout
} from '../../src/game/maps/river-bend';
import type { MapRunway } from '../../src/game/maps/shared/airfield';
import { AIRCRAFT_COLORS } from '../../src/game/palette';

const VIEWPORTS = [
  { width: 900, height: 1600, variant: 'portrait' },
  { width: 1600, height: 900, variant: 'landscape' },
  { width: 844, height: 390, variant: 'landscape' },
  { width: 900, height: 900, variant: 'square' }
] as const;

function runwayCorners(runway: MapRunway, lengthPadding = 0, widthPadding = 0): Vector2[] {
  const forward = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
  const right = { x: -forward.y, y: forward.x };
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({
    x: runway.center.x + forward.x * (runway.length * 0.5 + lengthPadding) * along
      + right.x * (runway.width * 0.5 + widthPadding) * across,
    y: runway.center.y + forward.y * (runway.length * 0.5 + lengthPadding) * along
      + right.y * (runway.width * 0.5 + widthPadding) * across
  }));
}

function pointToSegmentDistance(point: Vector2, start: Vector2, end: Vector2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(
    1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));
  return Math.hypot(
    point.x - start.x - dx * progress,
    point.y - start.y - dy * progress
  );
}

function distanceToPath(point: Vector2, path: readonly Vector2[]): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    distance = Math.min(distance, pointToSegmentDistance(point, path[index], path[index + 1]));
  }
  return distance;
}

function pointInRect(point: Vector2, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function pointInPolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const first = polygon[index];
    const second = polygon[previous];
    const crosses = first.y > point.y !== second.y > point.y
      && point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(
  firstStart: Vector2,
  firstEnd: Vector2,
  secondStart: Vector2,
  secondEnd: Vector2
): boolean {
  const cross = (a: Vector2, b: Vector2, c: Vector2): number =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const a = cross(firstStart, firstEnd, secondStart);
  const b = cross(firstStart, firstEnd, secondEnd);
  const c = cross(secondStart, secondEnd, firstStart);
  const d = cross(secondStart, secondEnd, firstEnd);
  return (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b))
    && (c === 0 || d === 0 || Math.sign(c) !== Math.sign(d));
}

function polygonIntersectsRect(
  polygon: readonly Vector2[],
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  if (polygon.some((point) => pointInRect(point, rect))) return true;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  if (corners.some((point) => pointInPolygon(point, polygon))) return true;
  return polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return corners.some((corner, cornerIndex) =>
      segmentsIntersect(start, end, corner, corners[(cornerIndex + 1) % corners.length])
    );
  });
}

function circleIntersectsRect(
  center: Vector2,
  radius: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - closestX, center.y - closestY) <= radius;
}

function rotatedRectangle(
  center: Vector2,
  width: number,
  height: number,
  angle: number
): Vector2[] {
  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const right = { x: -forward.y, y: forward.x };
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({
    x: center.x + forward.x * width * 0.5 * along + right.x * height * 0.5 * across,
    y: center.y + forward.y * width * 0.5 * along + right.y * height * 0.5 * across
  }));
}

function pathCorridor(path: readonly Vector2[], width: number): Vector2[][] {
  return path.slice(0, -1).map((start, index) => {
    const end = path[index + 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const right = { x: -Math.sin(angle) * width * 0.5, y: Math.cos(angle) * width * 0.5 };
    return [
      { x: start.x - right.x, y: start.y - right.y },
      { x: end.x - right.x, y: end.y - right.y },
      { x: end.x + right.x, y: end.y + right.y },
      { x: start.x + right.x, y: start.y + right.y }
    ];
  });
}

function airportPoints(layout: RiverBendLayout): Vector2[] {
  return [
    ...layout.runways.flatMap((runway) => runwayCorners(runway)),
    ...layout.apron,
    layout.helipad.center,
    ...layout.buildings.map(({ center }) => center)
  ];
}

function renderHarness() {
  const destroy = vi.fn();
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  let graphics: Phaser.GameObjects.Graphics;
  graphics = new Proxy({ destroy } as unknown as Phaser.GameObjects.Graphics, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver);
      let method = methods.get(property);
      if (!method) {
        method = vi.fn(() => graphics);
        methods.set(property, method);
      }
      return method;
    }
  });
  const texture = {
    setOrigin: vi.fn(),
    setDepth: vi.fn(),
    draw: vi.fn(),
    render: vi.fn()
  };
  texture.setOrigin.mockReturnValue(texture);
  texture.setDepth.mockReturnValue(texture);
  const scene = {
    add: {
      graphics: vi.fn(() => graphics),
      renderTexture: vi.fn(() => texture)
    }
  } as unknown as Phaser.Scene;
  return { scene, texture, destroy, methods };
}

function luminance(color: number): number {
  const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff]
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: number, second: number): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe('River Bend definition', () => {
  it('publishes immediately available intermediate metadata', () => {
    expect(RIVER_BEND_DEFINITION).toMatchObject({
      id: 'river-bend',
      trafficProfileId: 'river-bend',
      metadata: {
        name: 'River Bend',
        category: 'regional',
        unlockRankId: 'control-trainee'
      }
    });
  });

  it('keeps the route casing legible against terrain and every signal legible against its casing', () => {
    for (const color of Object.values(AIRCRAFT_COLORS)) {
      expect(contrast(color, ROUTE_OUTLINE_COLOR)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ROUTE_OUTLINE_COLOR, RIVER_BEND_PALETTE.terrain)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(VIEWPORTS)('keeps the compact $variant airport in bounds', ({ width, height, variant }) => {
    const layout = createRiverBendLayout(width, height);
    expect(layout.variant).toBe(variant);
    expect(layout.runways).toHaveLength(2);
    for (const point of airportPoints(layout)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(height);
    }
    expect(layout.taxiways.map(({ connects }) => connects)).toEqual([
      ['river-main', 'river-apron'],
      ['river-commuter', 'river-apron'],
      ['river-apron', 'river-helipad']
    ]);
  });

  it.each(VIEWPORTS)('treats the curved peripheral river only as clear scenery in $variant', ({
    width,
    height
  }) => {
    const layout = createRiverBendLayout(width, height);
    expect(layout.riverIsSceneryOnly).toBe(true);
    expect(layout.riverPath.length).toBeGreaterThanOrEqual(5);
    const riverY = layout.riverPath.map(({ y }) => y);
    expect(Math.max(...riverY) - Math.min(...riverY)).toBeGreaterThan(height * 0.5);
    expect(Math.max(...layout.riverPath.map(({ x }) => x))).toBeLessThan(width * 0.31);

    for (const zone of layout.landingZones) {
      expect(distanceToPath(zone.position, layout.riverPath)).toBeGreaterThan(
        layout.riverWidth / 2 + zone.captureRadius
      );
    }

    const airportFootprint = [
      ...layout.runways.flatMap((runway) =>
        runwayCorners(runway, runway.width * 0.2, runway.width * 0.26)
      ),
      ...layout.apron,
      ...layout.buildings.flatMap((building) =>
        rotatedRectangle(building.center, building.width + 10, building.height + 14, building.angle)
      )
    ];
    for (const point of airportFootprint) {
      expect(distanceToPath(point, layout.riverPath)).toBeGreaterThan(layout.riverWidth * 0.67);
    }
    expect(distanceToPath(layout.helipad.center, layout.riverPath) - layout.helipad.radius * 1.14)
      .toBeGreaterThan(layout.riverWidth * 0.67);
  });

  it.each(VIEWPORTS)('provides one HUD-safe guidance surface for every aircraft type in $variant', ({
    width,
    height
  }) => {
    const layout = createRiverBendLayout(width, height);
    expect(layout.landingZones.map(({ accepts }) => accepts).sort()).toEqual([
      'commuter',
      'liner',
      'rotor'
    ]);
    expect(layout.guidanceSurfaces.map(({ zoneId }) => zoneId)).toEqual(
      layout.landingZones.map(({ id }) => id)
    );
    for (const zone of layout.landingZones) {
      expect(layout.hudExclusionZones.some((rect) => pointInRect(zone.position, rect))).toBe(false);
    }
  });

  it.each(VIEWPORTS)('keeps full airport and river-detail extents clear of the HUD in $variant', ({
    width,
    height
  }) => {
    const layout = createRiverBendLayout(width, height);
    const polygons: Vector2[][] = [
      ...layout.runways.map((runway) =>
        runwayCorners(runway, runway.width * 0.2, runway.width * 0.26)
      ),
      [...layout.apron],
      ...layout.taxiways.flatMap((taxiway) => pathCorridor(taxiway.path, taxiway.width * 1.28)),
      ...layout.buildings.map((building) =>
        rotatedRectangle(building.center, building.width + 10, building.height + 14, building.angle)
      )
    ];
    for (const exclusion of layout.hudExclusionZones) {
      for (const polygon of polygons) {
        expect(polygonIntersectsRect(polygon, exclusion)).toBe(false);
      }
      expect(circleIntersectsRect(layout.helipad.center, layout.helipad.radius * 1.14, exclusion))
        .toBe(false);
      for (const tree of layout.bankTrees) {
        expect(circleIntersectsRect(tree.center, tree.radius, exclusion)).toBe(false);
      }
      for (const prop of layout.propAnchors) {
        expect(circleIntersectsRect(prop.position, prop.size * 0.5, exclusion)).toBe(false);
      }
      for (const sign of layout.signs) {
        expect(circleIntersectsRect(sign.position, 5, exclusion)).toBe(false);
      }
      for (const stand of layout.parkingStands) {
        expect(circleIntersectsRect(stand.position, stand.length * 0.5, exclusion)).toBe(false);
      }
    }
  });

  it.each(VIEWPORTS)('prepares deterministic $variant scenery and geometry', ({ width, height }) => {
    expect(createRiverBendLayout(width, height)).toEqual(createRiverBendLayout(width, height));
  });

  it('bakes the terrain once and retains the airport vectors', () => {
    const prepared = RIVER_BEND_DEFINITION.prepare({
      width: 900,
      height: 1600,
      detailLevel: 'mobile'
    });
    const harness = renderHarness();
    RIVER_BEND_DEFINITION.render(harness.scene, prepared);

    expect(harness.scene.add.renderTexture).toHaveBeenCalledOnce();
    expect(harness.scene.add.renderTexture).toHaveBeenCalledWith(0, 0, 900, 1600);
    expect(harness.texture.draw).toHaveBeenCalledOnce();
    expect(harness.texture.render).toHaveBeenCalledOnce();
    expect(harness.destroy).not.toHaveBeenCalled();
  });

  it('applies progressively richer mobile, tablet, and desktop detail budgets', () => {
    const fillCounts = (['mobile', 'tablet', 'desktop'] as const).map((detailLevel) => {
      const prepared = RIVER_BEND_DEFINITION.prepare({ width: 1000, height: 700, detailLevel });
      const harness = renderHarness();
      RIVER_BEND_DEFINITION.render(harness.scene, prepared);
      return harness.methods.get('fillCircle')?.mock.calls.length ?? 0;
    });

    expect(fillCounts[0]).toBeLessThan(fillCounts[1]);
    expect(fillCounts[1]).toBeLessThan(fillCounts[2]);
  });
});
