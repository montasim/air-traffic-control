import type Phaser from 'phaser';
import {
  composeStaticMap,
  clearOfAirfield,
  paintAirfieldGround,
  paintBuilding,
  paintHelipad,
  paintRunway,
  paintWaterPolygon,
  rotatedRectangle,
  tracePolygon,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { WorldDetailLevel } from '../../palette';
import {
  DESERT_PARALLEL_PALETTE,
  type DesertParallelLayout
} from './layout';
import type { AirfieldSign } from '../shared/airfield';

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
  shadow: 0x3b5049,
  vegetation: DESERT_PARALLEL_PALETTE.scrub,
  vegetationLight: DESERT_PARALLEL_PALETTE.stone
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

function paintTerrain(
  graphics: Phaser.GameObjects.Graphics,
  layout: DesertParallelLayout,
  unit: number
): void {
  graphics.fillStyle(DESERT_PARALLEL_PALETTE.mineralGround, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);

  for (const coast of layout.coastFragments) {
    paintWaterPolygon(graphics, coast.points, CIVIL_PALETTE);
  }

  for (const decoration of layout.decorations) {
    const size = unit * 0.01 * decoration.scale;
    if (!clearOfAirfield(layout, decoration.position, size * 2.8)) continue;
    if (decoration.kind === 'strata') {
      graphics.lineStyle(Math.max(1, unit * 0.002), DESERT_PARALLEL_PALETTE.dryWash, 0.23);
      graphics.lineBetween(
        decoration.position.x - Math.cos(decoration.angle) * size * 2.8,
        decoration.position.y - Math.sin(decoration.angle) * size * 2.8,
        decoration.position.x + Math.cos(decoration.angle) * size * 2.8,
        decoration.position.y + Math.sin(decoration.angle) * size * 2.8
      );
      continue;
    }
    if (decoration.kind === 'scrub') {
      graphics.fillStyle(DESERT_PARALLEL_PALETTE.scrub, 0.46);
      graphics.fillCircle(decoration.position.x, decoration.position.y, size * 0.64);
      graphics.fillCircle(decoration.position.x + size * 0.46, decoration.position.y + size * 0.12, size * 0.4);
      continue;
    }
    graphics.fillStyle(DESERT_PARALLEL_PALETTE.stone, 0.38);
    graphics.fillEllipse(decoration.position.x, decoration.position.y, size * 1.35, size * 0.72);
  }
}

function paintFacilities(
  graphics: Phaser.GameObjects.Graphics,
  layout: DesertParallelLayout,
  unit: number
): void {
  const landmark = layout.serviceLandmark;
  paintBuilding(graphics, {
    id: 'field-ops-main',
    center: landmark.center,
    width: landmark.width,
    height: landmark.height,
    angle: landmark.angle,
    kind: 'operations'
  }, CIVIL_PALETTE, layout.runways);

  for (const [index, prop] of layout.propAnchors.entries()) {
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
      continue;
    }
    paintBuilding(graphics, {
      id: prop.id,
      center: prop.position,
      width: prop.size,
      height: prop.size * (prop.kind === 'hangar' ? 0.5 : 0.7),
      angle: prop.angle,
      kind: prop.kind === 'hangar' ? 'hangar' : 'operations'
    }, CIVIL_PALETTE, layout.runways);
    if (index % 2 === 0) {
      graphics.lineStyle(Math.max(1, unit * 0.0015), DESERT_PARALLEL_PALETTE.runwayMarking, 0.24);
      const roof = rotatedRectangle(prop.position, prop.size * 0.72, prop.size * 0.18, prop.angle);
      graphics.lineBetween(roof[0].x, roof[0].y, roof[1].x, roof[1].y);
    }
  }

  for (const sign of visibleDesertLabels(layout)) paintVectorLabel(graphics, sign, unit);
}

export function renderDesertParallelMap(
  scene: Phaser.Scene,
  layout: DesertParallelLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics, unit}) => paintTerrain(graphics, layout, unit),
    operational: ({graphics, unit, detailLevel}) => {
    paintAirfieldGround(graphics, layout, CIVIL_PALETTE, detailLevel);
    for (const runway of layout.runways) {
      paintRunway(graphics, runway, CIVIL_PALETTE, layout.detailBudget.strata);
    }
    paintHelipad(graphics, layout.helipad, CIVIL_PALETTE);
    paintFacilities(graphics, layout, unit);
    },
    detail: () => {}
  }, {materialTextureKey: 'terrain:arcade:mineral'});
}
