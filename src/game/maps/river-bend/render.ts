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

  for (const building of layout.buildings) paintBuilding(graphics, building, palette, layout.runways);

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
    materialTextureKey: 'terrain:arcade:meadow'
  });
}
