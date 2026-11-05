import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  clearOfAirfield,
  composeStaticMap,
  MAP_DETAIL_BUDGETS,
  paintAirfieldGround,
  paintAirfieldGuides,
  paintControlTower,
  paintGroundTexture,
  paintHelipad,
  paintRaisedBuilding,
  paintRockRidge,
  paintMarkedRunway,
  paintSurfaceTexture,
  deterministicUnit,
  nearRiver,
  tracePolygon,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { Vector2 } from '../../../core/types';
import { pointInPolygon } from '../shared/apronLayout';
import type { FrostCrossingLayout } from './layout';

/** Ice-blue snow, slate rock, deep teal sea and dark pine: a bright winter coast. */
export const FROST_CROSSING_PALETTE: CivilMapPalette = {
  terrain: 0xd2eaf3,
  terrainLight: 0xe8f6fb,
  terrainDark: 0xb4d6e5,
  fieldLine: 0xbcdbe8,
  water: 0x2b77a0,
  waterEdge: 0xa8d8ea,
  waterShallow: 0x5aa2c4,
  airportGround: 0xc8e0ea,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x8f9a9e,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb5bab0,
  buildingRoof: 0xeee8d6,
  shadow: 0x4a6f86,
  vegetation: 0x1d4d35,
  vegetationLight: 0x2f6a4a,
};

/** Soft drifts: wide pale and shaded ellipses that break up the snow painted underneath. */
function paintDrifts(graphics: Phaser.GameObjects.Graphics, layout: FrostCrossingLayout, unit: number): void {
  for (let i = 0; i < 14; i += 1) {
    const x = deterministicUnit(i, 811) * layout.width;
    const y = deterministicUnit(i, 821) * layout.height;
    graphics.fillStyle(i % 2 ? FROST_CROSSING_PALETTE.terrainLight : FROST_CROSSING_PALETTE.terrainDark, 0.4);
    graphics.fillEllipse(x, y, unit * (0.3 + (i % 4) * 0.08), unit * (0.1 + (i % 3) * 0.04));
  }
}

/** Breaks a smooth outline into a ragged one: each edge cut into short steps nudged in and out. */
function jagged(outline: readonly Vector2[], unit: number): Vector2[] {
  const step = unit * 0.025;
  return outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const count = Math.max(1, Math.round(length / step));
    return Array.from({ length: count }, (_, k) => {
      const t = k / count;
      const nudge = k === 0 ? 0 : (deterministicUnit(i * 97 + k, 831) - 0.5) * unit * 0.024;
      return { x: a.x + (b.x - a.x) * t + normal.x * nudge, y: a.y + (b.y - a.y) * t + normal.y * nudge };
    });
  });
}

/**
 * Open sea along a ragged ice shore: a pale shelf over the snow, deep water, a lighter band just
 * off the ice, and broken floes drifting thickest near the shore.
 */
function paintIcySea(graphics: Phaser.GameObjects.Graphics, layout: FrostCrossingLayout, unit: number, floes: number): void {
  const palette = FROST_CROSSING_PALETTE;
  layout.water.forEach((water, w) => {
    const shore = jagged(water, unit);
    const closed = [...shore, shore[0]];
    const strokeShore = (width: number, color: number, alpha: number) => {
      graphics.lineStyle(width, color, alpha);
      tracePolygon(graphics, shore);
      graphics.strokePath();
    };
    strokeShore(unit * 0.07, palette.waterEdge, 0.7);
    graphics.fillStyle(palette.water, 1);
    tracePolygon(graphics, shore);
    graphics.fillPath();
    strokeShore(unit * 0.05, palette.waterShallow, 0.85);
    strokeShore(unit * 0.012, palette.terrainLight, 0.9);
    const xs = water.map((p) => p.x), ys = water.map((p) => p.y);
    const [left, right] = [Math.max(0, Math.min(...xs)), Math.min(layout.width, Math.max(...xs))];
    const [top, bottom] = [Math.max(0, Math.min(...ys)), Math.min(layout.height, Math.max(...ys))];
    for (let i = 0; i < floes; i += 1) {
      const seed = w * 1000 + i;
      const point = { x: left + deterministicUnit(seed, 841) * (right - left), y: top + deterministicUnit(seed, 853) * (bottom - top) };
      if (!pointInPolygon(point, shore)) continue;
      // Floes crowd the shore and thin out toward open water.
      const nearShore = nearRiver(closed, 0, point, unit * 0.14);
      if (!nearShore && deterministicUnit(seed, 857) > 0.15) continue;
      const size = unit * (nearShore ? 0.01 + deterministicUnit(seed, 859) * 0.022 : 0.006 + deterministicUnit(seed, 859) * 0.01);
      const floe = Array.from({ length: 6 }, (_, k) => {
        const turn = (k / 6) * Math.PI * 2 + deterministicUnit(seed, 863);
        const reach = size * (0.6 + deterministicUnit(seed * 6 + k, 867) * 0.6);
        return { x: point.x + Math.cos(turn) * reach, y: point.y + Math.sin(turn) * reach * 0.8 };
      });
      graphics.fillStyle(palette.waterShallow, 0.9);
      tracePolygon(graphics, floe.map((p) => ({ x: p.x + size * 0.2, y: p.y + size * 0.25 })));
      graphics.fillPath();
      graphics.fillStyle(0xf2fbfe, 0.95);
      tracePolygon(graphics, floe);
      graphics.fillPath();
    }
  });
}

/** Pine forest seen from above: dark crowns crowded together under a dusting of snow. */
function paintSnowyGroves(graphics: Phaser.GameObjects.Graphics, crowns: readonly { center: Vector2; radius: number }[]): void {
  const palette = FROST_CROSSING_PALETTE;
  graphics.fillStyle(palette.shadow, 0.3);
  for (const { center, radius } of crowns) graphics.fillCircle(center.x + radius * 0.55, center.y + radius * 0.6, radius);
  graphics.fillStyle(palette.vegetation, 1);
  for (const { center, radius } of crowns) graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(palette.vegetationLight, 1);
  for (const { center, radius } of crowns) graphics.fillCircle(center.x - radius * 0.2, center.y - radius * 0.2, radius * 0.7);
  crowns.forEach(({ center, radius }, i) => {
    graphics.fillStyle(0xf4fafc, 0.85);
    graphics.fillCircle(center.x - radius * 0.35, center.y - radius * 0.38, radius * 0.32);
    graphics.fillCircle(center.x + (deterministicUnit(i, 871) - 0.5) * radius, center.y + (deterministicUnit(i, 877) - 0.3) * radius * 0.8, radius * 0.18);
  });
}

export function renderFrostCrossingMap(scene: Phaser.Scene, layout: FrostCrossingLayout, detailLevel: WorldDetailLevel): void {
  // Ice-blue snow with a fine sparkle of white and blue shade.
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [] }, {
    base: FROST_CROSSING_PALETTE.terrain,
    fields: [],
    light: 0xffffff,
    dark: 0x8fbfd3
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      paintDrifts(graphics, layout, unit);
      paintIcySea(graphics, layout, unit, detailLevel === 'mobile' ? 160 : 320);
      // Each block grown a little about its middle so neighbours overlap into one broken mass.
      for (const ridge of layout.rocks) {
        const middle = ridge.reduce((sum, p) => ({ x: sum.x + p.x / ridge.length, y: sum.y + p.y / ridge.length }), { x: 0, y: 0 });
        paintRockRidge(graphics, ridge.map((p) => ({ x: middle.x + (p.x - middle.x) * 1.35, y: middle.y + (p.y - middle.y) * 1.35 })), unit);
      }
      const budget = Math.round(MAP_DETAIL_BUDGETS[detailLevel].trees * 10);
      paintSnowyGroves(graphics, layout.pines.slice(0, budget).filter((pine) => clearOfAirfield(layout, pine.center, pine.radius)));
    },
    operational: ({ graphics }) => {
      paintAirfieldGround(graphics, layout, FROST_CROSSING_PALETTE, detailLevel);
      for (const runway of layout.runways) paintMarkedRunway(graphics, runway, FROST_CROSSING_PALETTE, layout.landingZones);
      paintAirfieldGuides(graphics, layout, FROST_CROSSING_PALETTE, detailLevel);
      paintHelipad(graphics, layout.helipad, FROST_CROSSING_PALETTE);
    },
    detail: ({ graphics, unit }) => {
      for (const building of layout.buildings) paintRaisedBuilding(graphics, building, FROST_CROSSING_PALETTE, unit, layout.runways);
      paintControlTower(graphics, layout, FROST_CROSSING_PALETTE);
    },
  });
  // Runways only: the asphalt grain and rubber, with no apron or taxiway texture on this map.
  paintSurfaceTexture(scene, { ...layout, taxiways: [], apron: [], extraAprons: [], helipadApron: undefined }, { raisedBuildings: true });
}
