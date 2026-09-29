/*
THESIS: A connected regional gateway replaces isolated target slabs while keeping the lower field open for routing.
OWN-WORLD: Deep tidal greens, mineral asphalt, bone markings, irregular pools, field seams, and compact civil buildings.
STORY: Players read one coherent airport—two separate parallel runways, shared apron, terminal, taxiways, and helipad—before drawing.
FIRST VIEWPORT: The airfield occupies the high/right half; quiet fields and at least 35% open airspace extend below it.
FORM: Reference-one composition abstracted into original responsive vector geometry.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
*/
import type Phaser from 'phaser';
import {
  MAP_DETAIL_BUDGETS,
  composeStaticMap,
  paintApron,
  paintBuilding,
  paintFieldPolygon,
  paintHelipad,
  paintRunway,
  paintTaxiway,
  paintTree,
  paintWaterPolygon,
  strokePolyline,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { WorldDetailLevel } from '../../palette';
import type { SaltmarshGatewayLayout } from './layout';

export const SALTMARSH_GATEWAY_PALETTE: CivilMapPalette = {
  terrain: 0x819667,
  terrainLight: 0xa3b680,
  terrainDark: 0x6b835c,
  fieldLine: 0xbec5a1,
  water: 0x719fa4,
  waterEdge: 0xc0c6a2,
  waterShallow: 0xa5bfc0,
  airportGround: 0xa1ac8b,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x89938a,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb8b9a3,
  buildingRoof: 0xeee4c9,
  shadow: 0x3b5049,
  vegetation: 0x637e55,
  vegetationLight: 0x9db27a
};

function paintSaltmarshGateway(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshGatewayLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = SALTMARSH_GATEWAY_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  graphics.fillStyle(palette.terrainDark, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  graphics.fillStyle(palette.terrain, 0.95);
  graphics.fillRect(0, 0, layout.width, layout.height);

  layout.fieldPolygons.forEach((field, index) => {
    paintFieldPolygon(graphics, field, palette, index % 2 === 0);
  });
  for (const pool of layout.tidalPools) paintWaterPolygon(graphics, pool, palette);

  graphics.lineStyle(Math.max(2, Math.min(layout.width, layout.height) * 0.006), palette.fieldLine, 0.18);
  for (const road of layout.serviceRoads) strokePolyline(graphics, road);

  for (let index = 0; index < Math.min(budget.trees, layout.treeBelt.length); index += 1) {
    const tree = layout.treeBelt[index];
    paintTree(graphics, tree.center, tree.radius, palette, index);
  }

 }

function paintGatewayAirport(graphics: Phaser.GameObjects.Graphics, layout: SaltmarshGatewayLayout, detailLevel: WorldDetailLevel): void {
  const palette = SALTMARSH_GATEWAY_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];
  paintApron(graphics, layout.apron, palette);
  for (const taxiway of layout.taxiways) paintTaxiway(graphics, taxiway, palette);
  for (const runway of layout.runways) {
    paintRunway(graphics, runway, palette, budget.surfaceWear);
  }
  paintHelipad(graphics, layout.helipad, palette);


  for (const building of layout.buildings) paintBuilding(graphics, building, palette, layout.runways);
}

export function renderSaltmarshGateway(
  scene: Phaser.Scene,
  layout: SaltmarshGatewayLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics}) => paintSaltmarshGateway(graphics, layout, detailLevel),
    operational: ({graphics}) => paintGatewayAirport(graphics, layout, detailLevel),
    detail: () => {}
  }, {materialTextureKey: 'terrain:arcade:meadow'});
}
