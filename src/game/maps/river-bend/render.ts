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
  clearOfAirfield,
  paintAirfieldGround,
  paintAirfieldGuides,
  MAP_DETAIL_BUDGETS,
  composeStaticMap,
  paintControlTower,
  paintForests,
  paintGroundTexture,
  paintHedgerows,
  paintHelipad,
  paintRaisedBuilding,
  paintRiver,
  paintMarkedRunway,
  paintShadedTree,
  paintSurfaceTexture,
  smoothPath,
  strokePolyline,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { Vector2 } from '../../../core/types';
import type { RiverBendLayout } from './layout';

export const RIVER_BEND_PALETTE: CivilMapPalette = {
  // A richer olive meadow than before, kept apart from Gateway's greener grass.
  terrain: 0x8ea36b,
  terrainLight: 0x9aae78,
  terrainDark: 0x82976a,
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
  vegetation: 0x4f6a45,
  vegetationLight: 0x8aa36c
};

function paintScenery(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  // The ground and fields are painted underneath by paintGroundTexture; this layer holds scenery on top.
  const river = smoothPath(layout.riverPath, budget.riverSubdivisions);
  paintRiver(graphics, river, layout.riverWidth, palette);
  const unit = Math.min(layout.width, layout.height);
  const byRiver = (point: Vector2, radius: number) => nearRiver(river, layout.riverWidth, point, radius + unit * 0.02);
  paintHedgerows(graphics, layout, layout.fieldPolygons, palette, byRiver);
  paintForests(graphics, layout, palette, Math.round(budget.trees / 3), byRiver);
}

/** Whether a circle comes within the river's banks. */
function nearRiver(river: readonly Vector2[], width: number, point: Vector2, radius: number): boolean {
  return river.some((a, i) => {
    if (i === 0) return false;
    const b = river[i - 1];
    const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length));
    return Math.hypot(point.x - (a.x + (b.x - a.x) * t), point.y - (a.y + (b.y - a.y) * t)) < width * 0.67 + radius;
  });
}

function paintOperational(
  graphics: Phaser.GameObjects.Graphics,
  layout: RiverBendLayout,
  detailLevel: WorldDetailLevel
): void {
  const palette = RIVER_BEND_PALETTE;
  const budget = MAP_DETAIL_BUDGETS[detailLevel];

  paintAirfieldGround(graphics, layout, palette, detailLevel);
  for (const runway of layout.runways) {
    paintMarkedRunway(graphics, runway, palette, layout.landingZones);
  }
  paintAirfieldGuides(graphics, layout, palette, detailLevel);
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
    if (clearOfAirfield(layout, tree.center, tree.radius)) paintShadedTree(graphics, tree.center, tree.radius, palette, index);
  }

  graphics.lineStyle(
    Math.max(2, Math.min(layout.width, layout.height) * 0.006),
    palette.fieldLine,
    0.2
  );
  strokePolyline(graphics, layout.accessRoad);

  const unit = Math.min(layout.width, layout.height);
  for (const building of layout.buildings) paintRaisedBuilding(graphics, building, palette, unit, layout.runways);
  paintControlTower(graphics, layout, palette);

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
  const palette = RIVER_BEND_PALETTE;
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: layout.fieldPolygons }, {
    base: palette.terrain,
    // Close olive shades only: with crisp edges a dark field would read as a shadow.
    fields: [palette.terrainLight, 0x889e66, 0x9fb07c, palette.terrainDark, 0x93a771],
    light: 0xd6e2b0,
    dark: 0x4c6340
  });
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
  });
  paintSurfaceTexture(scene, layout, { raisedBuildings: true });
}
