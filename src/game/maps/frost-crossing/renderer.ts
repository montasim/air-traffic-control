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
  paintShoredPool,
  paintSurfaceTexture,
  paintSnowyPine,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { FrostCrossingLayout } from './layout';

/** Snow, slate, ice-blue water, and pine: a cold palette kept as quiet as the others. */
export const FROST_CROSSING_PALETTE: CivilMapPalette = {
  terrain: 0xe3ecee,
  terrainLight: 0xf3f7f8,
  terrainDark: 0xc9d7db,
  fieldLine: 0xbccdd2,
  water: 0x4f86a0,
  waterEdge: 0xa6cedb,
  waterShallow: 0x82b4c6,
  airportGround: 0xd3dfe2,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x8f9a9e,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb5bab0,
  buildingRoof: 0xeee8d6,
  shadow: 0x4f6670,
  vegetation: 0x2c5242,
  vegetationLight: 0x3d6650,
};

function paintSnowfield(graphics: Phaser.GameObjects.Graphics, layout: FrostCrossingLayout, unit: number): void {
  // The snow itself is painted underneath by paintGroundTexture. Soft drifts: wide pale and shaded ellipses that break up the white.
  for (let i = 0; i < 14; i += 1) {
    const a = Math.sin((i + 1) * 45.1) * 43758.5453;
    const b = Math.sin((i + 1) * 17.3 + 4) * 43758.5453;
    const x = (a - Math.floor(a)) * layout.width;
    const y = (b - Math.floor(b)) * layout.height;
    graphics.fillStyle(i % 2 ? FROST_CROSSING_PALETTE.terrainLight : FROST_CROSSING_PALETTE.terrainDark, 0.45);
    graphics.fillEllipse(x, y, unit * (0.3 + (i % 4) * 0.08), unit * (0.1 + (i % 3) * 0.04));
  }
  // Lakes with an icy shore, a pale shallow band and a deeper centre.
  for (const water of layout.water) paintShoredPool(graphics, water, FROST_CROSSING_PALETTE);
}

export function renderFrostCrossingMap(scene: Phaser.Scene, layout: FrostCrossingLayout, detailLevel: WorldDetailLevel): void {
  // Bare snow with a fine sparkle of white and blue-grey shade.
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [] }, {
    base: FROST_CROSSING_PALETTE.terrain,
    fields: [],
    light: 0xffffff,
    dark: 0xa3b7bf
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      paintSnowfield(graphics, layout, unit);
      for (const ridge of layout.rocks) paintRockRidge(graphics, ridge, unit);
      const budget = Math.round(MAP_DETAIL_BUDGETS[detailLevel].trees * 1.6);
      layout.pines.slice(0, budget).forEach((pine, index) => {
        if (clearOfAirfield(layout, pine.center, pine.radius)) paintSnowyPine(graphics, pine.center, pine.radius, index);
      });
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
