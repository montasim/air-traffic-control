import * as Art from '../../art/CanvasScene';
import type { WorldDetailLevel } from '../../palette';
import {
  addDriftingClouds,
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
  paintBrokenShore,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { Vector2 } from '../../../core/types';
import type { FrostCrossingLayout } from './layout';
import { castAlpha, castReach } from '../../rendering/shared-map/lighting';

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
  vegetation: 0x4a8a5c,
  vegetationLight: 0x2f6a4a,
};

/** Soft drifts: wide pale and shaded ellipses that break up the snow painted underneath. */
function paintDrifts(graphics: Art.Graphics, layout: FrostCrossingLayout, unit: number): void {
  for (let i = 0; i < 14; i += 1) {
    const x = deterministicUnit(i, 811) * layout.width;
    const y = deterministicUnit(i, 821) * layout.height;
    graphics.fillStyle(i % 2 ? FROST_CROSSING_PALETTE.terrainLight : FROST_CROSSING_PALETTE.terrainDark, 0.4);
    graphics.fillEllipse(x, y, unit * (0.3 + (i % 4) * 0.08), unit * (0.1 + (i % 3) * 0.04));
  }
}

/** Pine forest seen from above: dark crowns crowded together under a dusting of snow. */
function paintSnowyGroves(graphics: Art.Graphics, crowns: readonly { center: Vector2; radius: number }[]): void {
  const palette = FROST_CROSSING_PALETTE;
  graphics.fillStyle(palette.shadow, castAlpha(0.3));
  for (const { center, radius } of crowns) graphics.fillCircle(center.x + radius * 0.55 * castReach(), center.y + radius * 0.6 * castReach(), radius);
  // One deep green for every crown, no lighter highlight.
  graphics.fillStyle(palette.vegetation, 1);
  for (const { center, radius } of crowns) graphics.fillCircle(center.x, center.y, radius);
  crowns.forEach(({ center, radius }, i) => {
    graphics.fillStyle(0xf4fafc, 0.85);
    graphics.fillCircle(center.x - radius * 0.35, center.y - radius * 0.38, radius * 0.32);
    graphics.fillCircle(center.x + (deterministicUnit(i, 871) - 0.5) * radius, center.y + (deterministicUnit(i, 877) - 0.3) * radius * 0.8, radius * 0.18);
  });
}

export function renderFrostCrossingMap(scene: Art.Scene, layout: FrostCrossingLayout, detailLevel: WorldDetailLevel): void {
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
      paintBrokenShore(graphics, layout, layout.water, FROST_CROSSING_PALETTE, detailLevel === 'mobile' ? 160 : 320);
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
  // Clouds drifting over the snow and the sea.
  addDriftingClouds(scene, layout, { thinOver: (point, radius) => !clearOfAirfield(layout, point, radius) });
}
