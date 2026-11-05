import type Phaser from 'phaser';
import {
  addDriftingClouds,
  composeStaticMap,
  clearOfAirfield,
  paintAirfieldGround,
  deterministicUnit,
  MAP_DETAIL_BUDGETS,
  mixColor,
  paintAirfieldGuides,
  paintControlTower,
  paintForests,
  paintGroundTexture,
  paintHelipad,
  paintMarkedRunway,
  paintRaisedBuilding,
  paintSurfaceTexture,
  paintWaterPolygon,
  strokePolyline,
  tracePolygon,
  type CivilMapPalette,
  type MapBuilding
} from '../../rendering/shared-map';
import type { Vector2 } from '../../../core/types';
import type { WorldDetailLevel } from '../../palette';
import {
  DESERT_PARALLEL_PALETTE,
  type DesertParallelLayout
} from './layout';
import type { AirfieldSign } from '../shared/airfield';
import { castAlpha, castReach } from '../../rendering/shared-map/lighting';

const CIVIL_PALETTE: CivilMapPalette = {
  terrain: DESERT_PARALLEL_PALETTE.mineralGround,
  terrainLight: DESERT_PARALLEL_PALETTE.mineralHigh,
  terrainDark: DESERT_PARALLEL_PALETTE.mineralDeep,
  fieldLine: DESERT_PARALLEL_PALETTE.dryWash,
  water: DESERT_PARALLEL_PALETTE.coastDeep,
  waterEdge: DESERT_PARALLEL_PALETTE.coastShallow,
  waterShallow: DESERT_PARALLEL_PALETTE.coastShallow,
  airportGround: 0xa1ac8b,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x89938a,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb8b9a3,
  buildingRoof: 0xeee4c9,
  // A warm brown shadow, so shade on sand reads as shade rather than as a grey stain.
  shadow: 0x5a4632,
  vegetation: DESERT_PARALLEL_PALETTE.scrub,
  vegetationLight: 0x8f8f68
};

const VECTOR_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  I: ['111', '010', '010', '010', '111'],
  L: ['100', '100', '100', '100', '111'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  S: ['011', '100', '010', '001', '110']
};

export function visibleDesertLabels(layout: DesertParallelLayout): readonly AirfieldSign[] {
  return layout.detailBudget.showLabels ? layout.signs : [];
}

function paintVectorLabel(
  graphics: Phaser.GameObjects.Graphics,
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
  graphics.fillStyle(DESERT_PARALLEL_PALETTE.buildingRoof, 0.74);
  graphics.fillRoundedRect(left - cell * 1.2, top - cell, labelWidth + cell * 2.4, labelHeight + cell * 2, cell);
  graphics.fillStyle(DESERT_PARALLEL_PALETTE.runwayMarking, 0.72);
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

/** Wind-laid dune ripples: a lit crest with its shaded lee just downwind, broken wherever they would cross the airfield. */
function paintDuneRipples(graphics: Phaser.GameObjects.Graphics, layout: DesertParallelLayout, unit: number, count: number): void {
  const wind = -0.42;
  const along = { x: Math.cos(wind), y: Math.sin(wind) };
  const across = { x: -along.y, y: along.x };
  for (let i = 0; i < count; i += 1) {
    const start = { x: deterministicUnit(i, 503) * layout.width, y: deterministicUnit(i, 509) * layout.height };
    const length = unit * (0.14 + deterministicUnit(i, 521) * 0.16);
    const sway = unit * (0.008 + deterministicUnit(i, 523) * 0.012);
    const runs: Vector2[][] = [[]];
    for (let s = 0; s <= length; s += unit * 0.01) {
      const bend = Math.sin((s / length) * Math.PI * 2 + i) * sway;
      const point = { x: start.x + along.x * s + across.x * bend, y: start.y + along.y * s + across.y * bend };
      if (clearOfAirfield(layout, point, unit * 0.03)) runs[runs.length - 1].push(point);
      else if (runs[runs.length - 1].length) runs.push([]);
    }
    const lee = { x: across.x * unit * 0.004, y: across.y * unit * 0.004 };
    for (const run of runs.filter((points) => points.length > 2)) {
      graphics.lineStyle(Math.max(2, unit * 0.005), DESERT_PARALLEL_PALETTE.dryWash, 0.32);
      strokePolyline(graphics, run.map((p) => ({ x: p.x + lee.x, y: p.y + lee.y })));
      graphics.lineStyle(Math.max(1.5, unit * 0.003), DESERT_PARALLEL_PALETTE.mineralHigh, 0.75);
      strokePolyline(graphics, run);
    }
  }
}

/** Sandstone outcrops: an uneven boulder with a cast shadow, a shaded base and a sunlit top. */
function paintOutcrops(graphics: Phaser.GameObjects.Graphics, layout: DesertParallelLayout, unit: number, count: number): void {
  const rock = 0xb08e66;
  for (let i = 0; i < count; i += 1) {
    const center = { x: deterministicUnit(i, 541) * layout.width, y: deterministicUnit(i, 547) * layout.height };
    const radius = unit * (0.008 + deterministicUnit(i, 557) * 0.014);
    if (!clearOfAirfield(layout, center, radius + unit * 0.03)) continue;
    const outline = Array.from({ length: 7 }, (_, k) => {
      const turn = (k / 7) * Math.PI * 2;
      const reach = radius * (0.7 + deterministicUnit(i * 7 + k, 563) * 0.4);
      return { x: center.x + Math.cos(turn) * reach * 1.3, y: center.y + Math.sin(turn) * reach };
    });
    const offset = (shift: Vector2, scale = 1) => outline.map((p) => ({ x: center.x + (p.x - center.x) * scale + shift.x, y: center.y + (p.y - center.y) * scale + shift.y }));
    for (const [points, color, alpha] of [
      [offset({ x: radius * 0.9 * castReach(), y: radius * 0.7 * castReach() }), CIVIL_PALETTE.shadow, castAlpha(0.3)],
      [outline, mixColor(rock, CIVIL_PALETTE.shadow, 0.35), 1],
      [offset({ x: -radius * 0.18, y: -radius * 0.3 }, 0.78), rock, 1],
      [offset({ x: -radius * 0.32, y: -radius * 0.45 }, 0.4), mixColor(rock, 0xffffff, 0.3), 0.9]
    ] as const) {
      graphics.fillStyle(color, alpha);
      tracePolygon(graphics, points);
      graphics.fillPath();
    }
  }
}

function paintTerrain(
  graphics: Phaser.GameObjects.Graphics,
  layout: DesertParallelLayout,
  unit: number,
  detailLevel: WorldDetailLevel
): void {
  // The sand itself is painted underneath by paintGroundTexture; this layer holds scenery on top.
  const budget = MAP_DETAIL_BUDGETS[detailLevel];
  for (const coast of layout.coastFragments) {
    paintWaterPolygon(graphics, coast.points, CIVIL_PALETTE);
  }
  const offshore = (point: Vector2, radius: number) => layout.coastFragments.some((coast) =>
    coast.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < radius + unit * 0.12));
  paintDuneRipples(graphics, layout, unit, budget.trees);
  paintOutcrops(graphics, layout, unit, budget.trees);
  // Low scrub clumps toward the edges, sparser than a forest.
  paintForests(graphics, layout, CIVIL_PALETTE, Math.round(budget.trees / 4), offshore);
}

const landmarkBuilding = (layout: DesertParallelLayout): MapBuilding => {
  const landmark = layout.serviceLandmark;
  // The field's main building, so the control tower stands beside it.
  return { id: 'field-ops-main', center: landmark.center, width: landmark.width, height: landmark.height, angle: landmark.angle, kind: 'terminal' };
};
const propBuilding = (prop: DesertParallelLayout['propAnchors'][number]): MapBuilding => ({
  id: prop.id,
  center: prop.position,
  width: prop.size,
  height: prop.size * (prop.kind === 'hangar' ? 0.5 : 0.7),
  angle: prop.angle,
  kind: prop.kind === 'hangar' ? 'hangar' : 'operations'
});
/** Every building paintFacilities draws, so the surface texture can keep off them. */
const facilityBuildings = (layout: DesertParallelLayout): MapBuilding[] => [
  landmarkBuilding(layout),
  ...layout.propAnchors.filter((prop) => prop.id !== 'desert-ops' && prop.kind !== 'windsock').map(propBuilding)
];

function paintFacilities(
  graphics: Phaser.GameObjects.Graphics,
  layout: DesertParallelLayout,
  unit: number
): void {
  const buildings = facilityBuildings(layout);
  for (const building of buildings) paintRaisedBuilding(graphics, building, CIVIL_PALETTE, unit, layout.runways);
  paintControlTower(graphics, { ...layout, buildings }, CIVIL_PALETTE);

  for (const prop of layout.propAnchors) {
    if (prop.id === 'desert-ops') continue;
    if (prop.kind === 'windsock') {
      graphics.lineStyle(Math.max(1.5, unit * 0.002), DESERT_PARALLEL_PALETTE.runwayMarking, 0.6);
      graphics.lineBetween(prop.position.x, prop.position.y, prop.position.x, prop.position.y - prop.size);
      graphics.fillStyle(DESERT_PARALLEL_PALETTE.taxiwayMarking, 0.72);
      const flag = [
        { x: prop.position.x, y: prop.position.y - prop.size },
        { x: prop.position.x + prop.size * 0.72, y: prop.position.y - prop.size * 0.8 },
        { x: prop.position.x, y: prop.position.y - prop.size * 0.55 }
      ];
      tracePolygon(graphics, flag);
      graphics.fillPath();
    }
  }

  for (const sign of visibleDesertLabels(layout)) paintVectorLabel(graphics, sign, unit);
}

export function renderDesertParallelMap(
  scene: Phaser.Scene,
  layout: DesertParallelLayout,
  detailLevel: WorldDetailLevel
): void {
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [] }, {
    base: DESERT_PARALLEL_PALETTE.mineralGround,
    fields: [],
    light: 0xf2dfb6,
    dark: 0xa48a64
  });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics, unit}) => paintTerrain(graphics, layout, unit, detailLevel),
    operational: ({graphics, unit, detailLevel}) => {
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
  paintSurfaceTexture(scene, { ...layout, buildings: facilityBuildings(layout) }, { raisedBuildings: true });
  // A few clouds over the dry country; desert skies stay mostly clear.
  addDriftingClouds(scene, layout, { count: 3, thinOver: (point, radius) => !clearOfAirfield(layout, point, radius) });
}
