import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  clearOfAirfield,
  composeStaticMap,
  paintAirfieldGround,
  paintAirfieldGuides,
  paintCarrierDeck,
  paintCarrierIsland,
  paintCarrierWake,
  deterministicUnit,
  paintGroundTexture,
  paintHelipad,
  paintMarkedRunway,
  paintSurfaceTexture,
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

/** Broad, soft patches of deeper and shallower-looking water, so the open sea never reads as one flat colour. */
function paintDepthPatches(graphics: Phaser.GameObjects.Graphics, layout: BlueWaterLayout, unit: number): void {
  for (let i = 0; i < 12; i += 1) {
    const x = deterministicUnit(i, 901) * layout.width;
    const y = deterministicUnit(i, 907) * layout.height;
    const [w, h] = [unit * (0.45 + deterministicUnit(i, 911) * 0.4), unit * (0.2 + deterministicUnit(i, 919) * 0.2)];
    // Stacked faint rings, widest first, so each patch fades out with no hard edge.
    graphics.fillStyle(i % 3 === 0 ? BLUE_WATER_PALETTE.terrainLight : BLUE_WATER_PALETTE.terrainDark, 0.06);
    for (let ring = 1; ring >= 0.3; ring -= 0.14) graphics.fillEllipse(x, y, w * ring, h * ring);
  }
}

export function renderBlueWaterMap(scene: Phaser.Scene, layout: BlueWaterLayout, detailLevel: WorldDetailLevel): void {
  // Open ocean with a fine sparkle of foam-white and deep shade.
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [] }, {
    base: BLUE_WATER_PALETTE.water,
    fields: [],
    light: 0x9fd0dc,
    dark: 0x1d4d5d,
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      paintDepthPatches(graphics, layout, unit);
      paintSwellBands(graphics, layout, layout.carrier.angle + 0.5, BLUE_WATER_PALETTE.terrainDark, unit);
      paintWhitecaps(graphics, layout, detailLevel === 'mobile' ? 50 : 130, unit, (point) => clearOfAirfield(layout, point, unit * 0.04));
      paintCarrierWake(graphics, layout.carrier);
    },
    operational: ({ graphics, unit }) => {
      paintCarrierDeck(graphics, layout.carrier, unit);
      paintAirfieldGround(graphics, layout, BLUE_WATER_PALETTE, detailLevel);
      // The deck lanes take the same marked runway as every other map.
      // Both lanes take the same class, so only the first carries the sign; the second's would overlap it.
      layout.runways.forEach((runway, index) => paintMarkedRunway(graphics, runway, BLUE_WATER_PALETTE, layout.landingZones, index === 0));
      paintAirfieldGuides(graphics, layout, BLUE_WATER_PALETTE, detailLevel);
      for (const pad of layout.helipads) paintHelipad(graphics, pad, BLUE_WATER_PALETTE);
    },
    detail: ({ graphics, unit }) => paintCarrierIsland(graphics, layout.carrier, unit),
  });
  // Runways only: the asphalt grain and rubber, with no apron or taxiway texture on this map.
  paintSurfaceTexture(scene, { ...layout, taxiways: [], apron: [], extraAprons: [], helipadApron: undefined });
}
