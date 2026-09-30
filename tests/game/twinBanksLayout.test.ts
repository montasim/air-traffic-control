import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { Vector2 } from '../../src/core/types';
import {
  TWIN_BANKS_DETAIL_BUDGETS,
  TWIN_BANKS_MAP,
  createTwinBanksLayout,
  type TwinBanksLayout,
  type TwinBanksRoutingArea
} from '../../src/game/maps/twin-banks';
import type { HudExclusionZone } from '../../src/game/maps/types';
import { runwayCorners } from '../../src/game/rendering/shared-map';
import {
  eastBankPolygon,
  renderTwinBanksMap,
  visibleTwinBanksLabels
} from '../../src/game/maps/twin-banks/renderer';

const VIEWPORTS = [
  { width: 1370, height: 926, variant: 'square', detail: 'desktop' },
  { width: 1600, height: 900, variant: 'landscape', detail: 'desktop' },
  { width: 844, height: 390, variant: 'landscape', detail: 'mobile' },
  { width: 900, height: 1600, variant: 'portrait', detail: 'mobile' },
  { width: 900, height: 900, variant: 'square', detail: 'tablet' }
] as const;

const inBounds = (point: Vector2, layout: TwinBanksLayout): boolean =>
  point.x >= 0 && point.x <= layout.width && point.y >= 0 && point.y <= layout.height;

const inside = (point: Vector2, rectangle: TwinBanksRoutingArea | HudExclusionZone): boolean =>
  point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width &&
  point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height;

const overlaps = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rectangle: HudExclusionZone
): boolean =>
  bounds.minX <= rectangle.x + rectangle.width && bounds.maxX >= rectangle.x &&
  bounds.minY <= rectangle.y + rectangle.height && bounds.maxY >= rectangle.y;

const localAcross = (
  runway: TwinBanksLayout['runways'][number],
  point: Vector2
): number => {
  const dx = point.x - runway.center.x;
  const dy = point.y - runway.center.y;
  return dx * -Math.sin(runway.angle) + dy * Math.cos(runway.angle);
};

describe('Twin Banks layout', () => {
  it.each(VIEWPORTS)('authors bounded asymmetric fields in $variant', ({
    width,
    height,
    variant,
    detail
  }) => {
    const layout = createTwinBanksLayout(width, height, detail);
    expect(layout).toMatchObject({ width, height, variant });
    for (const runway of layout.runways) {
      for (const corner of runwayCorners(runway, runway.width * 0.2, runway.width * 0.26)) {
        expect(inBounds(corner, layout)).toBe(true);
        expect(layout.hudExclusionZones.some((hud) => inside(corner, hud))).toBe(false);
      }
    }
    for (const runway of layout.scenicRunways) {
      for (const corner of runwayCorners(runway, runway.width * 0.16, runway.width * 0.2)) {
        expect(inBounds(corner, layout)).toBe(true);
        expect(layout.hudExclusionZones.some((hud) => inside(corner, hud))).toBe(false);
      }
    }
    const operationalAnchors = [
      ...layout.apron,
      ...layout.westApron,
      ...layout.taxiways.flatMap((taxiway) => taxiway.path),
      ...layout.parkingStands.map((stand) => stand.position),
      ...layout.propAnchors.map((prop) => prop.position),
      ...layout.signs.map((sign) => sign.position),
      layout.helipad.center
    ];
    for (const point of operationalAnchors) {
      expect(inBounds(point, layout)).toBe(true);
      expect(layout.hudExclusionZones.some((hud) => inside(point, hud))).toBe(false);
    }
    expect(layout.runways[0].length).toBeGreaterThan(layout.runways[1].length);
    expect(layout.apron).not.toEqual(layout.westApron);
  });

  it.each(VIEWPORTS)('provides exactly one authoritative destination per aircraft in $variant', ({
    width,
    height,
    detail
  }) => {
    const layout = createTwinBanksLayout(width, height, detail);
    for (const type of ['liner', 'commuter', 'rotor'] as const) {
      expect(layout.landingZones.filter((zone) => zone.accepts === type)).toHaveLength(1);
    }
    expect(layout.landingZones).toHaveLength(3);
    expect(layout.guidanceSurfaces.map((surface) => surface.zoneId)).toEqual(
      layout.landingZones.map((zone) => zone.id)
    );
    expect(layout.scenicRunways.every((runway) => !('zoneId' in runway))).toBe(true);

    for (const runway of layout.runways) {
      const zone = layout.landingZones.find((candidate) => candidate.id === runway.zoneId)!;
      expect(localAcross(runway, zone.position)).toBeCloseTo(0, 8);
      expect(zone.angle).toBe(runway.angle);
    }
  });

  it.each(VIEWPORTS)('separates operational fields across the river in $variant', ({
    width,
    height,
    detail
  }) => {
    const layout = createTwinBanksLayout(width, height, detail);
    const riverX = layout.river.centerline.reduce((total, point) => total + point.x, 0) /
      layout.river.centerline.length;
    const westRunway = layout.runways.find((runway) => runway.id === 'west-commuter')!;
    const eastRunway = layout.runways.find((runway) => runway.id === 'east-main')!;
    expect(Math.max(...runwayCorners(westRunway).map((point) => point.x)))
      .toBeLessThan(riverX - layout.river.width / 2);
    expect(Math.min(...runwayCorners(eastRunway).map((point) => point.x)))
      .toBeGreaterThan(riverX + layout.river.width / 2);
    for (const scenic of layout.scenicRunways) {
      expect(Math.max(...runwayCorners(scenic).map((point) => point.x)))
        .toBeLessThan(riverX - layout.river.width / 2);
    }
    expect(layout.bridges).toHaveLength(1);
  });

  it.each(VIEWPORTS)('reserves at least 35 percent lower routing space in $variant', ({
    width,
    height,
    detail
  }) => {
    const layout = createTwinBanksLayout(width, height, detail);
    const unit = Math.min(width, height);
    const ratio = (layout.routingArea.width * layout.routingArea.height) / (width * height);
    expect(ratio).toBeGreaterThanOrEqual(0.35);
    for (const zone of layout.landingZones) {
      expect(inBounds(zone.position, layout)).toBe(true);
      expect(inside(zone.position, layout.routingArea)).toBe(false);
      expect(layout.hudExclusionZones.some((hud) => inside(zone.position, hud))).toBe(false);
    }
    for (const decoration of layout.decorations) {
      expect(inside(decoration.position, layout.routingArea)).toBe(false);
      const extent = decoration.kind === 'field'
        ? unit * 0.009 * decoration.scale * 3.8
        : decoration.kind === 'tree'
          ? unit * 0.009 * decoration.scale
          : unit * 0.012 * decoration.scale;
      const bounds = {
        minX: decoration.position.x - extent,
        minY: decoration.position.y - extent,
        maxX: decoration.position.x + extent,
        maxY: decoration.position.y + extent
      };
      expect(layout.hudExclusionZones.some((hud) => overlaps(bounds, hud))).toBe(false);
    }
  });

  it('is deterministic and applies explicit responsive detail budgets', () => {
    for (const detail of ['mobile', 'tablet', 'desktop'] as const) {
      const first = createTwinBanksLayout(1600, 900, detail);
      const second = createTwinBanksLayout(1600, 900, detail);
      const budget = TWIN_BANKS_DETAIL_BUDGETS[detail];
      expect(second).toEqual(first);
      expect(first.decorations).toHaveLength(
        budget.fieldBands + budget.trees + budget.riverMarks
      );
      expect(first.propAnchors).toHaveLength(budget.serviceProps);
    }
  });

  it('uses the river centerline as the painted bank boundary', () => {
    const layout = createTwinBanksLayout(1600, 900, 'desktop');
    expect(eastBankPolygon(layout).slice(0, layout.river.centerline.length))
      .toEqual(layout.river.centerline);
  });

  it('returns vector facility labels only above mobile detail', () => {
    expect(visibleTwinBanksLabels(createTwinBanksLayout(844, 390, 'mobile'))).toEqual([]);
    expect(visibleTwinBanksLabels(createTwinBanksLayout(900, 900, 'tablet'))
      .map((sign) => sign.label)).toEqual(['E', 'W', 'EAST OPS', 'WEST OPS']);
  });

  it('exports the expert definition with the v1 traffic-profile seam', () => {
    expect(TWIN_BANKS_MAP).toMatchObject({
      id: 'twin-banks',
      trafficProfileId: 'twin-banks',
      metadata: { category: 'regional', unlockRankId: 'tower-controller' }
    });
    const prepared = TWIN_BANKS_MAP.prepare({
      width: 1600,
      height: 900,
      detailLevel: 'desktop'
    });
    expect(prepared.layout.landingZones).toHaveLength(5);
    expect(prepared.layout.variant).toBe('landscape');
  });

  it('bakes terrain once and retains crisp airport vectors', () => {
    const graphics = Object.fromEntries([
      'fillStyle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath',
      'setDepth', 'clear', 'lineStyle', 'strokePath', 'fillCircle', 'strokeCircle', 'lineBetween',
      'strokeRoundedRect', 'fillRoundedRect'
    ].map((method) => [method, vi.fn().mockReturnThis()])) as Record<string, ReturnType<typeof vi.fn>>;
    graphics.destroy = vi.fn();
    const texture = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      draw: vi.fn().mockReturnThis(),
      render: vi.fn().mockReturnThis()
    };
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
        renderTexture: vi.fn(() => texture)
      }
    } as unknown as Phaser.Scene;

    renderTwinBanksMap(scene, createTwinBanksLayout(844, 390, 'mobile'), 'mobile');

    expect(scene.add.graphics).toHaveBeenCalledTimes(1);
    expect(scene.add.renderTexture).toHaveBeenCalledTimes(1);
    expect(texture.draw).toHaveBeenCalledOnce();
    expect(texture.render).toHaveBeenCalledOnce();
    expect(graphics.destroy).not.toHaveBeenCalled();
  });
});
