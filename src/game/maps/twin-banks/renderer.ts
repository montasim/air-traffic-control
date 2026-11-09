import * as Art from '../../art/CanvasScene';
import {
  addDriftingClouds,
  composeStaticMap,
  clearOfAirfield,
  paintAirfieldGround,
  deterministicUnit,
  fieldPatchwork,
  MAP_DETAIL_BUDGETS,
  nearRiver,
  paintAirfieldGuides,
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
  runwayCorners,
  smoothPath,
  tracePolygon,
  type CivilMapPalette,
  type MapBuilding
} from '../../rendering/shared-map';
import type { Vector2 } from '../../../core/types';
import type { WorldDetailLevel } from '../../palette';
import {
  TWIN_BANKS_PALETTE,
  type TwinBanksLayout
} from './layout';
import type { AirfieldSign } from '../shared/airfield';
import { pointInPolygon } from '../shared/apronLayout';
import { castAlpha, castReach } from '../../rendering/shared-map/lighting';

const CIVIL_PALETTE: CivilMapPalette = {
  terrain: TWIN_BANKS_PALETTE.eastGround,
  terrainLight: TWIN_BANKS_PALETTE.eastHigh,
  terrainDark: TWIN_BANKS_PALETTE.westGround,
  fieldLine: TWIN_BANKS_PALETTE.fieldLine,
  water: TWIN_BANKS_PALETTE.riverDeep,
  waterEdge: TWIN_BANKS_PALETTE.riverShelf,
  waterShallow: TWIN_BANKS_PALETTE.riverMid,
  airportGround: 0xa1ac8b,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x89938a,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb8b9a3,
  buildingRoof: 0xeee4c9,
  shadow: 0x3b5049,
  vegetation: TWIN_BANKS_PALETTE.tree,
  vegetationLight: TWIN_BANKS_PALETTE.eastHigh
};

const VECTOR_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['010', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  W: ['101', '101', '101', '111', '101']
};

export function visibleTwinBanksLabels(layout: TwinBanksLayout): readonly AirfieldSign[] {
  return layout.detailBudget.showLabels ? layout.signs : [];
}

export function eastBankPolygon(layout: TwinBanksLayout): readonly { x: number; y: number }[] {
  return [
    ...layout.river.centerline,
    { x: layout.width, y: layout.height },
    { x: layout.width, y: 0 }
  ];
}

function paintVectorLabel(
  graphics: Art.Graphics,
  sign: AirfieldSign,
  unit: number
): void {
  const label = sign.label.toUpperCase();
  const cell = Math.max(1.4, unit * 0.0024);
  const characterWidth = cell * 4;
  const labelWidth = Math.max(cell * 3, label.length * characterWidth - cell);
  const labelHeight = cell * 5;
  const left = sign.position.x - labelWidth / 2;
  const top = sign.position.y - labelHeight / 2;
  graphics.fillStyle(TWIN_BANKS_PALETTE.buildingRoof, 0.74);
  graphics.fillRoundedRect(left - cell * 1.2, top - cell, labelWidth + cell * 2.4, labelHeight + cell * 2, cell);
  graphics.fillStyle(TWIN_BANKS_PALETTE.runwayMarking, 0.72);
  for (const [characterIndex, character] of [...label].entries()) {
    const glyph = VECTOR_GLYPHS[character];
    if (!glyph) continue;
    for (const [row, pixels] of glyph.entries()) {
      for (const [column, pixel] of [...pixels].entries()) {
        if (pixel === '1') {
          graphics.fillRect(
            left + characterIndex * characterWidth + column * cell,
            top + row * cell,
            cell * 0.78,
            cell * 0.78
          );
        }
      }
    }
  }
}

const riverPathOf = (layout: TwinBanksLayout) => smoothPath(layout.river.centerline, Math.max(4, layout.detailBudget.riverMarks));

/** Golden stubble on the dry west bank, greener meadow on the east, in close shades so no field reads as a shadow. */
const WEST_FIELDS = [0xb8aa7d, 0xaa9c6f, 0xbfb184, 0xa89a6c];
const EAST_FIELDS = [0x8aa275, 0x7c956a, 0x93a97c, 0x86a070];

/**
 * A loose patchwork of fields on both banks: a jittered grid, each cell coloured for the bank
 * it lies on, with cells by the river left out so no field crosses to the other bank.
 */
function bankFields(layout: TwinBanksLayout): { polygons: Vector2[][]; colors: number[] } {
  const cell = Math.min(layout.width, layout.height) * 0.24;
  const river = riverPathOf(layout);
  const east = eastBankPolygon(layout);
  const middle = (quad: readonly Vector2[]) => ({ x: (quad[0].x + quad[2].x) / 2, y: (quad[0].y + quad[2].y) / 2 });
  const polygons = fieldPatchwork(layout.width, layout.height, cell).filter((quad) => !nearRiver(river, layout.river.width, middle(quad), cell * 0.75));
  const colors = polygons.map((quad, index) => {
    const shades = pointInPolygon(middle(quad), east) ? EAST_FIELDS : WEST_FIELDS;
    return shades[Math.floor(deterministicUnit(index, 613) * shades.length)];
  });
  return { polygons, colors };
}

function paintTerrain(
  graphics: Art.Graphics,
  layout: TwinBanksLayout,
  unit: number,
  detailLevel: WorldDetailLevel
): void {
  // Both banks and their fields are painted underneath by paintGroundTexture; this layer holds scenery on top.
  const budget = MAP_DETAIL_BUDGETS[detailLevel];
  const riverPath = riverPathOf(layout);
  paintRiver(graphics, riverPath, layout.river.width, CIVIL_PALETTE);
  const byRiver = (point: Vector2, radius: number) => nearRiver(riverPath, layout.river.width, point, radius + unit * 0.02);
  paintHedgerows(graphics, layout, bankFields(layout).polygons, CIVIL_PALETTE, byRiver);
  paintForests(graphics, layout, CIVIL_PALETTE, Math.round(budget.trees / 3), byRiver);
  for (const [index, decoration] of layout.decorations.entries()) {
    if (decoration.kind !== 'tree') continue;
    const size = unit * 0.009 * decoration.scale;
    if (clearOfAirfield(layout, decoration.position, size) && !byRiver(decoration.position, size)) {
      paintShadedTree(graphics, decoration.position, size, CIVIL_PALETTE, index);
    }
  }
  for (const decoration of layout.decorations) {
    if (decoration.kind !== 'river-mark') continue;
    graphics.lineStyle(Math.max(1, unit * 0.0015), TWIN_BANKS_PALETTE.riverMid, 0.32);
    graphics.lineBetween(
      decoration.position.x - unit * 0.012 * decoration.scale,
      decoration.position.y,
      decoration.position.x + unit * 0.012 * decoration.scale,
      decoration.position.y
    );
  }

  for (const bridge of layout.bridges) {
    const shadow = runwayCorners({
      center: { x: bridge.center.x + 4 * castReach(), y: bridge.center.y + 6 * castReach() },
      length: bridge.length,
      width: bridge.width,
      angle: bridge.angle
    });
    graphics.fillStyle(TWIN_BANKS_PALETTE.riverDeep, castAlpha(0.35));
    tracePolygon(graphics, shadow);
    graphics.fillPath();
    graphics.fillStyle(TWIN_BANKS_PALETTE.bridge, 1);
    tracePolygon(graphics, runwayCorners(bridge));
    graphics.fillPath();
  }
}

function paintScenicRunways(
  graphics: Art.Graphics,
  layout: TwinBanksLayout
): void {
  for (const runway of layout.scenicRunways) {
    graphics.fillStyle(TWIN_BANKS_PALETTE.runwayShoulder, 0.38);
    tracePolygon(graphics, runwayCorners(runway, runway.width * 0.16, runway.width * 0.2));
    graphics.fillPath();
    graphics.fillStyle(TWIN_BANKS_PALETTE.scenicRunway, 0.78);
    tracePolygon(graphics, runwayCorners(runway));
    graphics.fillPath();
    graphics.lineStyle(Math.max(1, runway.width * 0.045), TWIN_BANKS_PALETTE.runwayMarking, 0.24);
    const half = runway.length * 0.38;
    graphics.lineBetween(
      runway.center.x - Math.cos(runway.angle) * half,
      runway.center.y - Math.sin(runway.angle) * half,
      runway.center.x + Math.cos(runway.angle) * half,
      runway.center.y + Math.sin(runway.angle) * half
    );
  }
}

const propBuilding = (prop: TwinBanksLayout['propAnchors'][number]): MapBuilding => ({
  id: prop.id,
  center: prop.position,
  width: prop.size,
  height: prop.size * (prop.kind === 'hangar' ? 0.52 : 0.68),
  angle: prop.angle,
  // East ops is the field's main building, so the control tower stands beside it.
  kind: prop.kind === 'hangar' ? 'hangar' : prop.id === 'east-ops' ? 'terminal' : 'operations'
});
/** Every building paintFacilities draws, so the surface texture can keep off them. */
const facilityBuildings = (layout: TwinBanksLayout): MapBuilding[] =>
  layout.propAnchors.filter((prop) => prop.kind !== 'windsock').map(propBuilding);

function paintFacilities(
  graphics: Art.Graphics,
  layout: TwinBanksLayout,
  unit: number
): void {
  const buildings = facilityBuildings(layout);
  for (const building of buildings) paintRaisedBuilding(graphics, building, CIVIL_PALETTE, unit, layout.runways);
  paintControlTower(graphics, { ...layout, buildings }, CIVIL_PALETTE);
  for (const prop of layout.propAnchors) {
    if (prop.kind !== 'windsock') continue;
    graphics.lineStyle(Math.max(1.4, unit * 0.002), TWIN_BANKS_PALETTE.runwayMarking, 0.6);
    graphics.lineBetween(prop.position.x, prop.position.y, prop.position.x, prop.position.y - prop.size);
  }

  for (const sign of visibleTwinBanksLabels(layout)) {
    const margin = Math.max(1.4, unit * 0.0024) * (sign.label.length * 2 + 2);
    const overlapsRunway = layout.runways.some((runway) => {
      const dx = sign.position.x - runway.center.x;
      const dy = sign.position.y - runway.center.y;
      const along = dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle);
      const across = -dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle);
      return Math.abs(along) < runway.length / 2 + margin &&
        Math.abs(across) < runway.width / 2 + margin;
    });
    if (!overlapsRunway) paintVectorLabel(graphics, sign, unit);
  }
}

export function renderTwinBanksMap(
  scene: Art.Scene,
  layout: TwinBanksLayout,
  detailLevel: WorldDetailLevel
): void {
  const fields = bankFields(layout);
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [eastBankPolygon(layout), ...fields.polygons] }, {
    base: TWIN_BANKS_PALETTE.westGround,
    // One colour per polygon: the east bank first, then each field's own shade.
    fields: [TWIN_BANKS_PALETTE.eastGround, ...fields.colors],
    light: 0xdfe0b4,
    dark: 0x5d6a48
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics, unit}) => paintTerrain(graphics, layout, unit, detailLevel),
    operational: ({graphics, unit, detailLevel}) => {
    paintScenicRunways(graphics, layout);
    paintAirfieldGround(graphics, layout, CIVIL_PALETTE, detailLevel);
    for (const runway of layout.runways) {
      paintMarkedRunway(graphics, runway, CIVIL_PALETTE, layout.landingZones);
    }
    paintAirfieldGuides(graphics, layout, CIVIL_PALETTE, detailLevel);
    paintHelipad(graphics, layout.helipad, CIVIL_PALETTE);
    paintFacilities(graphics, layout, unit);
    },
    detail: () => {}
  });
  paintSurfaceTexture(scene, { ...layout, extraAprons: [layout.westApron], buildings: facilityBuildings(layout) }, { raisedBuildings: true });
  // Clouds drifting across both banks.
  addDriftingClouds(scene, layout, { thinOver: (point, radius) => !clearOfAirfield(layout, point, radius) });
}
