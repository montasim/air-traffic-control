import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { Vector2 } from '../../src/core/types';
import {
  SALTMARSH_GATEWAY_DEFINITION,
  SALTMARSH_GATEWAY_PALETTE,
  createSaltmarshGatewayLayout,
  type SaltmarshGatewayLayout
} from '../../src/game/maps/saltmarsh-gateway';
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

function runwayIntersection(first: MapRunway, second: MapRunway): {
  firstAlong: number;
  secondAlong: number;
} {
  const firstDirection = { x: Math.cos(first.angle), y: Math.sin(first.angle) };
  const secondDirection = { x: Math.cos(second.angle), y: Math.sin(second.angle) };
  const delta = {
    x: second.center.x - first.center.x,
    y: second.center.y - first.center.y
  };
  const denominator = firstDirection.x * secondDirection.y
    - firstDirection.y * secondDirection.x;
  return {
    firstAlong: (delta.x * secondDirection.y - delta.y * secondDirection.x) / denominator,
    secondAlong: (delta.x * firstDirection.y - delta.y * firstDirection.x) / denominator
  };
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

function operationalPoints(layout: SaltmarshGatewayLayout): Vector2[] {
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

describe('Saltmarsh Gateway definition', () => {
  it('publishes beginner metadata and a stable traffic profile id', () => {
    expect(SALTMARSH_GATEWAY_DEFINITION).toMatchObject({
      id: 'saltmarsh-gateway',
      trafficProfileId: 'saltmarsh-gateway',
      metadata: {
        name: 'Saltmarsh Gateway',
        difficulty: 'beginner',
        unlockRankId: 'control-trainee'
      }
    });
  });

  it('keeps every reserved route color strongly legible over the dominant terrain', () => {
    for (const color of Object.values(AIRCRAFT_COLORS)) {
      expect(contrast(color, SALTMARSH_GATEWAY_PALETTE.terrain)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(VIEWPORTS)('authors a connected $variant airport inside $width x $height', ({
    width,
    height,
    variant
  }) => {
    const layout = createSaltmarshGatewayLayout(width, height);
    expect(layout.variant).toBe(variant);
    expect(layout.runways).toHaveLength(2);

    const [main, commuter] = layout.runways;
    expect(main.length / main.width).toBeGreaterThanOrEqual(12);
    expect(main.length / main.width).toBeLessThanOrEqual(14);
    expect(commuter.length / commuter.width).toBeGreaterThanOrEqual(11);
    expect(commuter.length / commuter.width).toBeLessThanOrEqual(13);

    for (const point of operationalPoints(layout)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(height);
      expect(pointInRect(point, layout.openAirspace)).toBe(false);
    }

    const intersection = runwayIntersection(main, commuter);
    expect(Math.abs(intersection.firstAlong)).toBeLessThan(main.length / 2);
    expect(Math.abs(intersection.secondAlong)).toBeLessThan(commuter.length / 2);
    expect(layout.taxiways.map(({ connects }) => connects)).toEqual([
      ['gateway-main', 'gateway-apron'],
      ['gateway-commuter', 'gateway-apron'],
      ['gateway-apron', 'gateway-helipad']
    ]);
    expect(layout.taxiways[2].path.at(-1)).toEqual(layout.helipad.center);
    expect(pointInPolygon(layout.buildings[0].center, layout.apron)).toBe(true);
  });

  it.each(VIEWPORTS)('preserves at least 35% open routing airspace in $variant', ({ width, height }) => {
    const layout = createSaltmarshGatewayLayout(width, height);
    const openRatio = layout.openAirspace.width * layout.openAirspace.height / (width * height);
    expect(openRatio).toBeGreaterThanOrEqual(0.35);
  });

  it.each(VIEWPORTS)('provides one HUD-safe guidance surface for every aircraft type in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshGatewayLayout(width, height);
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

  it.each(VIEWPORTS)('keeps complete airport and scenery-detail extents clear of the HUD in $variant', ({
    width,
    height
  }) => {
    const layout = createSaltmarshGatewayLayout(width, height);
    const polygons: Vector2[][] = [
      ...layout.runways.map((runway) =>
        runwayCorners(runway, runway.width * 0.2, runway.width * 0.26)
      ),
      [...layout.apron],
      ...layout.taxiways.flatMap((taxiway) => pathCorridor(taxiway.path, taxiway.width * 1.28)),
      ...layout.buildings.map((building) =>
        rotatedRectangle(building.center, building.width + 10, building.height + 14, building.angle)
      ),
      ...layout.tidalPools.map((pool) => [...pool])
    ];

    for (const exclusion of layout.hudExclusionZones) {
      for (const polygon of polygons) {
        expect(polygonIntersectsRect(polygon, exclusion)).toBe(false);
      }
      expect(circleIntersectsRect(layout.helipad.center, layout.helipad.radius * 1.14, exclusion))
        .toBe(false);
      for (const tree of layout.treeBelt) {
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

  it.each(VIEWPORTS)('prepares deterministic $variant geometry', ({ width, height }) => {
    expect(createSaltmarshGatewayLayout(width, height)).toEqual(
      createSaltmarshGatewayLayout(width, height)
    );
  });

  it('renders all static scenery into exactly one texture', () => {
    const prepared = SALTMARSH_GATEWAY_DEFINITION.prepare({
      width: 1600,
      height: 900,
      detailLevel: 'desktop'
    });
    const harness = renderHarness();
    SALTMARSH_GATEWAY_DEFINITION.render(harness.scene, prepared);

    expect(harness.scene.add.renderTexture).toHaveBeenCalledOnce();
    expect(harness.scene.add.renderTexture).toHaveBeenCalledWith(0, 0, 1600, 900);
    expect(harness.texture.draw).toHaveBeenCalledOnce();
    expect(harness.texture.render).toHaveBeenCalledOnce();
    expect(harness.destroy).toHaveBeenCalledOnce();
  });

  it('applies progressively richer mobile, tablet, and desktop detail budgets', () => {
    const fillCounts = (['mobile', 'tablet', 'desktop'] as const).map((detailLevel) => {
      const prepared = SALTMARSH_GATEWAY_DEFINITION.prepare({ width: 1000, height: 700, detailLevel });
      const harness = renderHarness();
      SALTMARSH_GATEWAY_DEFINITION.render(harness.scene, prepared);
      return harness.methods.get('fillCircle')?.mock.calls.length ?? 0;
    });

    expect(fillCounts[0]).toBeLessThan(fillCounts[1]);
    expect(fillCounts[1]).toBeLessThan(fillCounts[2]);
  });
});
