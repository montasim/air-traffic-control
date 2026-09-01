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
import { riverBendTerrainTextureKey } from '../../assets/presentationAssets';
import {
  MAP_DETAIL_BUDGETS,
  composeStaticMap,
  paintApron,
  paintBuilding,
  paintHelipad,
  paintRiver,
  paintRunway,
  paintTaxiway,
  paintTree,
  smoothPath,
  strokePolyline,
  tracePolygon,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { RiverBendLayout } from './layout';

export const RIVER_BEND_PALETTE: CivilMapPalette = {
  terrain: 0x37392f,
  terrainLight: 0x47493b,
  terrainDark: 0x292d28,
  fieldLine: 0x7f806e,
  water: 0x3b5152,
  waterEdge: 0x657069,
  waterShallow: 0x78847b,
  airportGround: 0x50534b,
  asphalt: 0x242a29,
  asphaltEdge: 0x666a62,
  apron: 0x3b403d,
  marking: 0xe4deca,
  taxiwayMarking: 0x958661,
  building: 0x434943,
  buildingRoof: 0xaaa58f,
  shadow: 0x181d1b,
  vegetation: 0x343c31,
  vegetationLight: 0x555b48
};

function paintScenery(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  graphics.fillStyle(palette.terrainDark, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  graphics.fillStyle(palette.terrain, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);

  layout.fieldPolygons.forEach((field, index) => {
    graphics.fillStyle(
      index % 2 === 1 ? palette.terrainLight : palette.terrainDark,
      index % 2 === 1 ? 0.25 : 0.16
    );
    tracePolygon(graphics, field);
    graphics.fillPath();
    graphics.lineStyle(1, palette.fieldLine, 0.14);
    tracePolygon(graphics, field);
    graphics.strokePath();
  });

  const river = smoothPath(layout.riverPath, budget.riverSubdivisions);
  paintRiver(graphics, river, layout.riverWidth, palette);
}

function paintOperational(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  paintApron(graphics, layout.apron, palette);
  for (const taxiway of layout.taxiways) paintTaxiway(graphics, taxiway, palette);
  for (const runway of layout.runways) {
    paintRunway(graphics, runway, palette, budget.surfaceWear);
  }
  paintHelipad(graphics, layout.helipad, palette);

  graphics.lineStyle(
    Math.max(1.2, Math.min(layout.width, layout.height) * 0.002),
    palette.marking,
    0.42
  );
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

  graphics.lineStyle(
    Math.max(1.5, Math.min(layout.width, layout.height) * 0.0022),
    palette.marking,
    0.68
  );
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
}

function paintDetail(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  for (let index = 0; index < Math.min(budget.trees, layout.bankTrees.length); index += 1) {
    const tree = layout.bankTrees[index];
    paintTree(graphics, tree.center, tree.radius, palette, index);
  }

  graphics.lineStyle(
    Math.max(2, Math.min(layout.width, layout.height) * 0.006),
    palette.fieldLine,
    0.2
  );
  strokePolyline(graphics, layout.accessRoad);
  graphics.lineStyle(
    Math.max(1, Math.min(layout.width, layout.height) * 0.0015),
    palette.fieldLine,
    0.12
  );
  for (let line = 0; line < budget.fieldLines; line += 1) {
    const progress = (line + 1) / (budget.fieldLines + 1);
    const x = layout.width * (0.34 + (line % 5) * 0.13);
    const y = layout.height * (0.58 + progress * 0.37);
    graphics.lineBetween(x, y, Math.min(layout.width, x + layout.width * 0.18), y - layout.height * 0.012);
  }

  for (const building of layout.buildings) paintBuilding(graphics, building, palette);

  const windsock = layout.propAnchors.find(({ kind }) => kind === 'windsock');
  if (windsock) {
    const poleHeight = windsock.size * 0.72;
    graphics.lineStyle(Math.max(1.2, windsock.size * 0.08), palette.buildingRoof, 0.72);
    graphics.lineBetween(
      windsock.position.x,
      windsock.position.y,
      windsock.position.x,
      windsock.position.y - poleHeight
    );
    graphics.fillStyle(palette.taxiwayMarking, 0.78);
    graphics.fillTriangle(
      windsock.position.x,
      windsock.position.y - poleHeight,
      windsock.position.x + windsock.size * 0.52,
      windsock.position.y - poleHeight * 0.82,
      windsock.position.x,
      windsock.position.y - poleHeight * 0.62
    );
  }

  for (const sign of layout.signs) {
    const size = Math.max(4, Math.min(layout.width, layout.height) * 0.006);
    graphics.fillStyle(palette.shadow, 0.68);
    graphics.fillRoundedRect(
      sign.position.x - size * 0.62,
      sign.position.y - size * 0.36,
      size * 1.24,
      size * 0.72,
      Math.max(1, size * 0.12)
    );
    graphics.lineStyle(Math.max(1, size * 0.1), palette.taxiwayMarking, 0.66);
    graphics.strokeRoundedRect(
      sign.position.x - size * 0.62,
      sign.position.y - size * 0.36,
      size * 1.24,
      size * 0.72,
      Math.max(1, size * 0.12)
    );
  }
}

export function renderRiverBend(
  scene: Phaser.Scene,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, layout: prepared, detailLevel: detail }) => {
      paintScenery(graphics, prepared, detail);
    },
    operational: ({ graphics, layout: prepared, detailLevel: detail }) => {
      paintOperational(graphics, prepared, detail);
    },
    detail: ({ graphics, layout: prepared, detailLevel: detail }) => {
      paintDetail(graphics, prepared, detail);
    }
  }, {
    sceneryTextureKey: riverBendTerrainTextureKey(layout.variant)
  });
}
