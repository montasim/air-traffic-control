import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  clearOfAirfield,
  composeStaticMap,
  paintAirfieldGround,
  paintCarrierDeck,
  paintCarrierIsland,
  paintCarrierWake,
  paintHelipad,
  paintSwellBands,
  paintWhitecaps,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { BlueWaterLayout } from './layout';

/** Deep, slightly green ocean; the deck is the only hard surface. */
export const BLUE_WATER_PALETTE: CivilMapPalette = {
  terrain: 0x3d7486,
  terrainLight: 0x4d8597,
  terrainDark: 0x2f6070,
  fieldLine: 0x5b92a2,
  water: 0x3d7486,
  waterEdge: 0x7fb3c0,
  waterShallow: 0x5a96a6,
  airportGround: 0x56636a,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x6b777c,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0x8c9599,
  buildingRoof: 0xb3bbbd,
  shadow: 0x0d2730,
  vegetation: 0x3d7486,
  vegetationLight: 0x4d8597,
};

export function renderBlueWaterMap(scene: Phaser.Scene, layout: BlueWaterLayout, detailLevel: WorldDetailLevel): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      graphics.fillStyle(BLUE_WATER_PALETTE.water, 1);
      graphics.fillRect(0, 0, layout.width, layout.height);
      paintSwellBands(graphics, layout, layout.carrier.angle + 0.5, BLUE_WATER_PALETTE.terrainDark, unit);
      if (detailLevel !== 'mobile') paintWhitecaps(graphics, layout, 70, unit, (point) => clearOfAirfield(layout, point, unit * 0.04));
      paintCarrierWake(graphics, layout.carrier);
    },
    operational: ({ graphics, unit }) => {
      paintCarrierDeck(graphics, layout.carrier, unit);
      paintAirfieldGround(graphics, layout, BLUE_WATER_PALETTE, detailLevel);
      for (const pad of layout.helipads) paintHelipad(graphics, pad, BLUE_WATER_PALETTE);
    },
    detail: ({ graphics, unit }) => paintCarrierIsland(graphics, layout.carrier, unit),
  });
}
