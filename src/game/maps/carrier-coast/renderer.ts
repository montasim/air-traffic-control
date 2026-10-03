import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  clearOfAirfield,
  composeStaticMap,
  paintAirfieldGround,
  paintBuilding,
  paintCarrierDeck,
  paintCarrierIsland,
  paintCarrierWake,
  paintHelipad,
  paintIslet,
  paintRunway,
  paintSwellBands,
  paintTree,
  strokePolyline,
  tracePolygon,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { CarrierCoastLayout } from './layout';

/** Warm sand above a clear coastal sea, joined by a band of shore green. */
export const CARRIER_COAST_PALETTE: CivilMapPalette = {
  terrain: 0xd8c597,
  terrainLight: 0xe6d6ad,
  terrainDark: 0xc2ad7e,
  fieldLine: 0xc9b585,
  water: 0x4f9ab9,
  waterEdge: 0x9fd2df,
  waterShallow: 0x79bcd3,
  airportGround: 0xcdbd93,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x969487,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb8b9a3,
  buildingRoof: 0xeee4c9,
  shadow: 0x4c5a4a,
  vegetation: 0x8e9d55,
  vegetationLight: 0xa8b56a,
};
const SHORE = 0x9fc07a;

function paintCoast(graphics: Phaser.GameObjects.Graphics, layout: CarrierCoastLayout, unit: number): void {
  graphics.fillStyle(CARRIER_COAST_PALETTE.water, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  paintSwellBands(graphics, layout, layout.carrier.angle + 0.4, 0x2f7898, unit);
  // Shallows, the shore band, then the sand.
  graphics.lineStyle(unit * 0.11, CARRIER_COAST_PALETTE.waterEdge, 0.55);
  strokePolyline(graphics, layout.coastline);
  graphics.fillStyle(SHORE, 1);
  tracePolygon(graphics, layout.land);
  graphics.fillPath();
  const inland = layout.land.map((p, i) => (i < layout.coastline.length ? { x: p.x + unit * 0.035, y: p.y - unit * 0.02 } : p));
  graphics.fillStyle(CARRIER_COAST_PALETTE.terrain, 1);
  tracePolygon(graphics, inland);
  graphics.fillPath();
  for (const islet of layout.islets) paintIslet(graphics, islet);
}

export function renderCarrierCoastMap(scene: Phaser.Scene, layout: CarrierCoastLayout, detailLevel: WorldDetailLevel): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      paintCoast(graphics, layout, unit);
      paintCarrierWake(graphics, layout.carrier);
      const budget = detailLevel === 'mobile' ? 18 : 36;
      layout.scrub.slice(0, budget).forEach((bush, index) => {
        if (clearOfAirfield(layout, bush.center, bush.radius)) paintTree(graphics, bush.center, bush.radius, CARRIER_COAST_PALETTE, index);
      });
    },
    operational: ({ graphics, unit }) => {
      paintCarrierDeck(graphics, layout.carrier, unit);
      paintAirfieldGround(graphics, layout, CARRIER_COAST_PALETTE, detailLevel);
      paintRunway(graphics, layout.runways[0], CARRIER_COAST_PALETTE);
      for (const pad of layout.helipads) paintHelipad(graphics, pad, CARRIER_COAST_PALETTE);
    },
    detail: ({ graphics, unit }) => {
      for (const building of layout.buildings) paintBuilding(graphics, building, CARRIER_COAST_PALETTE, layout.runways.slice(0, 1));
      paintCarrierIsland(graphics, layout.carrier, unit);
    },
  }, { materialTextureKey: 'terrain:arcade:mineral' });
}
