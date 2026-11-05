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
  clearOfAirfield,
  paintAirfieldGround,
  paintAirfieldGuides,
  MAP_DETAIL_BUDGETS,
  composeStaticMap,
  paintRaisedBuilding,
  paintShadedTree,
  paintSurfaceTexture,
  paintGroundTexture,
  paintHelipad,
  strokePolyline,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { WorldDetailLevel } from '../../palette';
import type { SaltmarshGatewayLayout } from './layout';
import { paintControlTower, paintForests, paintHedgerows, paintMarkedRunway, paintShoredPool } from './scenery';

/** Brighter, warmer greens with clear field contrast, blue water and plain grey asphalt. */
export const SALTMARSH_GATEWAY_PALETTE: CivilMapPalette = {
  terrain: 0x86a84f,
  terrainLight: 0xa9c25f,
  terrainDark: 0x6a8c3d,
  fieldLine: 0xc9d39a,
  water: 0x3f93b8,
  waterEdge: 0xe2dcae,
  waterShallow: 0x7cc4d6,
  airportGround: 0xa7b384,
  asphalt: 0x666d70,
  asphaltEdge: 0xc8ccc2,
  apron: 0x9aa09d,
  marking: 0xfbf8ee,
  taxiwayMarking: 0xf0c64a,
  building: 0xa99f8a,
  buildingRoof: 0xece1c6,
  shadow: 0x2d4433,
  vegetation: 0x4d7a30,
  vegetationLight: 0x93bb4c
};

function paintSaltmarshGateway(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshGatewayLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = SALTMARSH_GATEWAY_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  // The ground and fields are painted underneath by paintGroundTexture; this layer holds scenery on top.
  for (const pool of layout.tidalPools) paintShoredPool(graphics, pool, palette);
  paintHedgerows(graphics, layout, palette);

  graphics.lineStyle(Math.max(2, Math.min(layout.width, layout.height) * 0.006), palette.fieldLine, 0.18);
  for (const road of layout.serviceRoads) strokePolyline(graphics, road);

  for (let index = 0; index < Math.min(budget.trees, layout.treeBelt.length); index += 1) {
    const tree = layout.treeBelt[index];
    if (clearOfAirfield(layout, tree.center, tree.radius)) paintShadedTree(graphics, tree.center, tree.radius, palette, index);
  }
  paintForests(graphics, layout, palette, Math.round(budget.trees / 3));

 }

function paintGatewayAirport(graphics: Phaser.GameObjects.Graphics, layout: SaltmarshGatewayLayout, detailLevel: WorldDetailLevel): void {
  const palette = SALTMARSH_GATEWAY_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];
  paintAirfieldGround(graphics, layout, palette, detailLevel);
  for (const runway of layout.runways) {
    paintMarkedRunway(graphics, runway, palette, layout.landingZones);
  }
  paintAirfieldGuides(graphics, layout, palette, detailLevel);
  paintHelipad(graphics, layout.helipad, palette);


  const unit = Math.min(layout.width, layout.height);
  for (const building of layout.buildings) paintRaisedBuilding(graphics, building, palette, unit, layout.runways);
  paintControlTower(graphics, layout, palette);
}

export function renderSaltmarshGateway(
  scene: Phaser.Scene,
  layout: SaltmarshGatewayLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = SALTMARSH_GATEWAY_PALETTE;
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: layout.fieldPolygons, angle: layout.runways[0].angle }, {
    base: palette.terrain,
    fields: [palette.terrainLight, palette.terrain, 0xb3c463, palette.terrainDark, 0x9cba58],
    light: 0xd8eb8c,
    dark: 0x3c6624
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics}) => paintSaltmarshGateway(graphics, layout, detailLevel),
    operational: ({graphics}) => paintGatewayAirport(graphics, layout, detailLevel),
    detail: () => {}
  });
  paintSurfaceTexture(scene, layout);
}
