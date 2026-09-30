import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { Vector2 } from '../../src/core/types';
import {
  DESERT_DETAIL_BUDGETS,
  DESERT_PARALLEL_MAP,
  DESERT_PARALLEL_PALETTE,
  createDesertParallelLayout,
  type DesertParallelLayout,
  type RoutingArea
} from '../../src/game/maps/desert-parallel';
import type { HudExclusionZone } from '../../src/game/maps/types';
import { runwayCorners } from '../../src/game/rendering/shared-map';
import {
  renderDesertParallelMap,
  visibleDesertLabels
} from '../../src/game/maps/desert-parallel/renderer';

const VIEWPORTS = [
  { width: 1370, height: 926, variant: 'square', detail: 'desktop' },
  { width: 1600, height: 900, variant: 'landscape', detail: 'desktop' },
  { width: 844, height: 390, variant: 'landscape', detail: 'mobile' },
  { width: 900, height: 1600, variant: 'portrait', detail: 'mobile' },
  { width: 900, height: 900, variant: 'square', detail: 'tablet' }
] as const;

const inBounds = (point: Vector2, layout: DesertParallelLayout): boolean =>
  point.x >= 0 && point.x <= layout.width && point.y >= 0 && point.y <= layout.height;

const inside = (point: Vector2, rectangle: RoutingArea | HudExclusionZone): boolean =>
  point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width &&
  point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height;

const overlaps = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rectangle: HudExclusionZone
): boolean =>
  bounds.minX <= rectangle.x + rectangle.width && bounds.maxX >= rectangle.x &&
  bounds.minY <= rectangle.y + rectangle.height && bounds.maxY >= rectangle.y;

const localRunwayCoordinates = (
  runway: DesertParallelLayout['runways'][number],
  point: Vector2
): { along: number; across: number } => {
  const dx = point.x - runway.center.x;
  const dy = point.y - runway.center.y;
  return {
    along: dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle),
    across: dx * -Math.sin(runway.angle) + dy * Math.cos(runway.angle)
  };
};

const luminance = (color: number): number => {
  const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

describe('Desert Parallel layout', () => {
  it.each(VIEWPORTS)('authors a bounded responsive $variant composition', ({
    width,
    height,
    variant,
    detail
  }) => {
    const layout = createDesertParallelLayout(width, height, detail);
    expect(layout).toMatchObject({ width, height, variant });

    for (const runway of layout.runways) {
      expect(runway.length / runway.width).toBeGreaterThan(14);
      for (const corner of runwayCorners(runway)) {
        expect(inBounds(corner, layout)).toBe(true);
        expect(layout.hudExclusionZones.some((hud) => inside(corner, hud))).toBe(false);
      }
    }
    const operationalAnchors = [
      ...layout.apron,
      ...layout.taxiways.flatMap((taxiway) => taxiway.path),
      ...layout.holdShortMarkers.map((marker) => marker.position),
      ...layout.parkingStands.map((stand) => stand.position),
      ...layout.propAnchors.map((prop) => prop.position),
      ...layout.signs.map((sign) => sign.position),
      layout.helipad.center,
      layout.serviceLandmark.center
    ];
    for (const point of operationalAnchors) {
      expect(inBounds(point, layout)).toBe(true);
      expect(layout.hudExclusionZones.some((hud) => inside(point, hud))).toBe(false);
    }
    for (const zone of layout.landingZones) {
      expect(inBounds(zone.position, layout)).toBe(true);
      expect(layout.hudExclusionZones.some((hud) => inside(zone.position, hud))).toBe(false);
      expect(inside(zone.position, layout.routingArea)).toBe(false);
    }
  });

  it.each(VIEWPORTS)('keeps one authoritative, aligned destination per aircraft in $variant', ({
    width,
    height,
    detail
  }) => {
    const layout = createDesertParallelLayout(width, height, detail);
    expect(layout.landingZones.map((zone) => zone.accepts)).toEqual([
      'liner',
      'commuter',
      'rotor'
    ]);
    expect(new Set(layout.landingZones.map((zone) => zone.accepts)).size).toBe(3);
    expect(layout.guidanceSurfaces.map((surface) => surface.zoneId)).toEqual(
      layout.landingZones.map((zone) => zone.id)
    );

    for (const runway of layout.runways) {
      const zone = layout.landingZones.find((candidate) => candidate.id === runway.zoneId)!;
      const local = localRunwayCoordinates(runway, zone.position);
      expect(local.across).toBeCloseTo(0, 8);
      expect(Math.abs(local.along)).toBeLessThan(runway.length / 2);
      expect(zone.angle).toBe(runway.angle);
    }
  });

  it.each(VIEWPORTS)('reserves at least 35 percent open routing area in $variant', ({
    width,
    height,
    detail
  }) => {
    const layout = createDesertParallelLayout(width, height, detail);
    const unit = Math.min(width, height);
    const ratio = (layout.routingArea.width * layout.routingArea.height) / (width * height);
    expect(ratio).toBeGreaterThanOrEqual(0.35);
    for (const decoration of layout.decorations) {
      expect(inside(decoration.position, layout.routingArea)).toBe(false);
      const size = unit * 0.01 * decoration.scale;
      const extent = decoration.kind === 'strata' ? size * 2.8 : size * 0.72;
      const bounds = {
        minX: decoration.position.x - extent,
        minY: decoration.position.y - extent,
        maxX: decoration.position.x + extent,
        maxY: decoration.position.y + extent
      };
      expect(layout.hudExclusionZones.some((hud) => overlaps(bounds, hud))).toBe(false);
    }
  });

  it('uses offset parallel axes and a central service landmark', () => {
    const layout = createDesertParallelLayout(1600, 900, 'desktop');
    const [liner, commuter] = layout.runways;
    expect(Math.abs(liner.angle - commuter.angle)).toBeLessThan(0.2);
    expect(Math.abs(liner.center.y - commuter.center.y)).toBeGreaterThan(liner.width * 2.5);
    expect(layout.serviceLandmark.center.x).toBeGreaterThan(layout.width * 0.55);
    expect(layout.serviceLandmark.center.y).toBeGreaterThan(liner.center.y);
    expect(layout.serviceLandmark.center.y).toBeLessThan(commuter.center.y);
  });

  it('keeps dark pavement distinct from markings and reserved aircraft signals', () => {
    const runwayLight = luminance(DESERT_PARALLEL_PALETTE.runway);
    const markingLight = luminance(DESERT_PARALLEL_PALETTE.runwayMarking);
    const contrast = (markingLight + 0.05) / (runwayLight + 0.05);
    expect(contrast).toBeGreaterThan(8);
    expect([
      DESERT_PARALLEL_PALETTE.liner,
      DESERT_PARALLEL_PALETTE.commuter,
      DESERT_PARALLEL_PALETTE.rotor
    ]).not.toContain(DESERT_PARALLEL_PALETTE.mineralGround);
  });

  it('is deterministic and scales only the responsive detail budget', () => {
    for (const detail of ['mobile', 'tablet', 'desktop'] as const) {
      const first = createDesertParallelLayout(1600, 900, detail);
      const second = createDesertParallelLayout(1600, 900, detail);
      const budget = DESERT_DETAIL_BUDGETS[detail];
      expect(second).toEqual(first);
      expect(first.decorations).toHaveLength(budget.strata + budget.scrub + budget.stones);
      expect(first.coastFragments).toHaveLength(budget.coastFragments);
    }
  });

  it('returns vector facility labels only above mobile detail', () => {
    expect(visibleDesertLabels(createDesertParallelLayout(844, 390, 'mobile'))).toEqual([]);
    expect(visibleDesertLabels(createDesertParallelLayout(900, 900, 'tablet'))
      .map((sign) => sign.label)).toEqual(['A', 'B', 'FIELD OPS']);
  });

  it('exports the advanced map definition and prepares through the shared seam', () => {
    expect(DESERT_PARALLEL_MAP).toMatchObject({
      id: 'desert-parallel',
      trafficProfileId: 'desert-parallel',
      metadata: { category: 'regional', unlockRankId: 'control-assistant' }
    });
    const prepared = DESERT_PARALLEL_MAP.prepare({
      width: 900,
      height: 1600,
      detailLevel: 'mobile'
    });
    expect(prepared.layout.landingZones).toHaveLength(5);
    expect(prepared.layout.variant).toBe('portrait');
  });

  it('bakes terrain once and retains crisp airport vectors', () => {
    const graphics = Object.fromEntries([
      'fillStyle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath',
      'setDepth', 'clear', 'lineStyle', 'strokePath', 'fillCircle', 'fillEllipse', 'lineBetween',
      'strokeRoundedRect', 'fillRoundedRect', 'strokeCircle'
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

    renderDesertParallelMap(
      scene,
      createDesertParallelLayout(844, 390, 'mobile'),
      'mobile'
    );

    expect(scene.add.graphics).toHaveBeenCalledTimes(1);
    expect(scene.add.renderTexture).toHaveBeenCalledTimes(1);
    expect(texture.draw).toHaveBeenCalledOnce();
    expect(texture.render).toHaveBeenCalledOnce();
    expect(graphics.destroy).not.toHaveBeenCalled();
  });
});
