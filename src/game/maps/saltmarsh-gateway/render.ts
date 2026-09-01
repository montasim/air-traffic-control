/*
THESIS: A connected regional gateway replaces isolated target slabs while keeping the lower field open for routing.
OWN-WORLD: Deep tidal greens, mineral asphalt, bone markings, irregular pools, field seams, and compact civil buildings.
STORY: Players read one coherent airport—two intersecting runways, shared apron, terminal, taxiways, and helipad—before drawing.
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
  terrain: 0x293c34,
  terrainLight: 0x34493e,
  terrainDark: 0x172a25,
  fieldLine: 0x74806a,
  water: 0x315359,
  waterEdge: 0x233e43,
  waterShallow: 0x6d7770,
  airportGround: 0x4b5a50,
  asphalt: 0x273431,
  asphaltEdge: 0x59645c,
  apron: 0x3c4944,
  marking: 0xe5e1cf,
  taxiwayMarking: 0xb49b59,
  building: 0x394641,
  buildingRoof: 0xa7aa95,
  shadow: 0x102420,
  vegetation: 0x263f34,
  vegetationLight: 0x53634d
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
  graphics.lineStyle(Math.max(1, Math.min(layout.width, layout.height) * 0.0014), palette.marking, 0.12);
  for (let line = 0; line < budget.fieldLines; line += 1) {
    const progress = (line + 1) / (budget.fieldLines + 1);
    const y = layout.openAirspace.y + layout.openAirspace.height * progress;
    graphics.lineBetween(0, y, layout.width * (0.28 + (line % 4) * 0.12), y - layout.height * 0.018);
  }

  for (let index = 0; index < Math.min(budget.trees, layout.treeBelt.length); index += 1) {
    const tree = layout.treeBelt[index];
    paintTree(graphics, tree.center, tree.radius, palette, index);
  }

  paintApron(graphics, layout.apron, palette);
  for (const taxiway of layout.taxiways) paintTaxiway(graphics, taxiway, palette);
  for (const runway of layout.runways) {
    paintRunway(graphics, runway, palette, budget.surfaceWear);
  }
  paintHelipad(graphics, layout.helipad, palette);

  graphics.lineStyle(Math.max(1.2, Math.min(layout.width, layout.height) * 0.002), palette.marking, 0.48);
  for (const stand of layout.parkingStands) {
    const dx = Math.cos(stand.angle) * stand.length * 0.5;
    const dy = Math.sin(stand.angle) * stand.length * 0.5;
    graphics.lineBetween(
      stand.position.x - dx,
      stand.position.y - dy,
      stand.position.x + dx,
      stand.position.y + dy
    );
  }
  graphics.lineStyle(Math.max(1.6, Math.min(layout.width, layout.height) * 0.0022), palette.marking, 0.72);
  for (const marker of layout.holdShortMarkers) {
    const dx = Math.cos(marker.angle) * marker.width * 0.5;
    const dy = Math.sin(marker.angle) * marker.width * 0.5;
    graphics.lineBetween(
      marker.position.x - dx,
      marker.position.y - dy,
      marker.position.x + dx,
      marker.position.y + dy
    );
  }

  for (const building of layout.buildings) paintBuilding(graphics, building, palette);
}

export function renderSaltmarshGateway(
  scene: Phaser.Scene,
  layout: SaltmarshGatewayLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, ({ graphics, layout: prepared, detailLevel: detail }) => {
    paintSaltmarshGateway(graphics, prepared, detail);
  });
}
