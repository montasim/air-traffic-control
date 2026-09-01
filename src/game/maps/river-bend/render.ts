/*
THESIS: A compact regional airport is remembered by one peripheral river bend, not by terrain obstacles or decorative clutter.
OWN-WORLD: Mineral olive fields, slate water, pale banks, bone runway paint, and a small connected civil apron.
STORY: Players recognize the river as orientation scenery while every aircraft type still has an obvious compatible surface.
FIRST VIEWPORT: The airport sits high/right; a broad organic river curves around the left and lower edge, away from approaches.
FORM: The reference river landmark is re-authored as responsive Catmull-Rom vector geography.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
*/
import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  MAP_DETAIL_BUDGETS,
  composeStaticMap,
  paintApron,
  paintBuilding,
  paintFieldPolygon,
  paintHelipad,
  paintRiver,
  paintRunway,
  paintTaxiway,
  paintTree,
  smoothPath,
  strokePolyline,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { RiverBendLayout } from './layout';

export const RIVER_BEND_PALETTE: CivilMapPalette = {
  terrain: 0x323a31,
  terrainLight: 0x414737,
  terrainDark: 0x2a3028,
  fieldLine: 0x858269,
  water: 0x38565a,
  waterEdge: 0x72765f,
  waterShallow: 0x83908a,
  airportGround: 0x555c50,
  asphalt: 0x2c3633,
  asphaltEdge: 0x656a5f,
  apron: 0x414a45,
  marking: 0xe7e1ce,
  taxiwayMarking: 0xb39a5b,
  building: 0x454b45,
  buildingRoof: 0xb0ae93,
  shadow: 0x22281f,
  vegetation: 0x354534,
  vegetationLight: 0x66705a
};

function paintRiverBend(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  graphics.fillStyle(palette.terrainDark, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  graphics.fillStyle(palette.terrain, 0.96);
  graphics.fillRect(0, 0, layout.width, layout.height);
  layout.fieldPolygons.forEach((field, index) => {
    paintFieldPolygon(graphics, field, palette, index % 2 === 1);
  });

  const river = smoothPath(layout.riverPath, budget.riverSubdivisions);
  paintRiver(graphics, river, layout.riverWidth, palette);
  for (let index = 0; index < Math.min(budget.trees, layout.bankTrees.length); index += 1) {
    const tree = layout.bankTrees[index];
    paintTree(graphics, tree.center, tree.radius, palette, index);
  }

  graphics.lineStyle(Math.max(2, Math.min(layout.width, layout.height) * 0.006), palette.fieldLine, 0.24);
  strokePolyline(graphics, layout.accessRoad);
  graphics.lineStyle(Math.max(1, Math.min(layout.width, layout.height) * 0.0015), palette.marking, 0.1);
  for (let line = 0; line < budget.fieldLines; line += 1) {
    const progress = (line + 1) / (budget.fieldLines + 1);
    const x = layout.width * (0.34 + (line % 5) * 0.13);
    const y = layout.height * (0.58 + progress * 0.37);
    graphics.lineBetween(x, y, Math.min(layout.width, x + layout.width * 0.18), y - layout.height * 0.012);
  }

  paintApron(graphics, layout.apron, palette);
  for (const taxiway of layout.taxiways) paintTaxiway(graphics, taxiway, palette);
  for (const runway of layout.runways) {
    paintRunway(graphics, runway, palette, budget.surfaceWear);
  }
  paintHelipad(graphics, layout.helipad, palette);

  graphics.lineStyle(Math.max(1.2, Math.min(layout.width, layout.height) * 0.002), palette.marking, 0.46);
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
  graphics.lineStyle(Math.max(1.5, Math.min(layout.width, layout.height) * 0.0022), palette.marking, 0.7);
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

export function renderRiverBend(
  scene: Phaser.Scene,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, ({ graphics, layout: prepared, detailLevel: detail }) => {
    paintRiverBend(graphics, prepared, detail);
  });
}
