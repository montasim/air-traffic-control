import type Phaser from 'phaser';
import {
  composeStaticMap,
  paintApron,
  paintBuilding,
  paintHelipad,
  paintRiver,
  paintRunway,
  paintTaxiway,
  paintTree,
  runwayCorners,
  smoothPath,
  tracePolygon,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { WorldDetailLevel } from '../../palette';
import {
  TWIN_BANKS_PALETTE,
  type TwinBanksLayout
} from './layout';
import type { AirfieldSign } from '../shared/airfield';

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

function paintTerrain(
  graphics: Phaser.GameObjects.Graphics,
  layout: TwinBanksLayout,
  unit: number
): void {
  graphics.fillStyle(TWIN_BANKS_PALETTE.westGround, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  graphics.fillStyle(TWIN_BANKS_PALETTE.eastGround, 1);
  tracePolygon(graphics, eastBankPolygon(layout));
  graphics.fillPath();

  for (const [index, decoration] of layout.decorations.entries()) {
    if (decoration.kind === 'river-mark') continue;
    const size = unit * 0.009 * decoration.scale;
    if (decoration.kind === 'tree') {
      paintTree(graphics, decoration.position, size, CIVIL_PALETTE, index);
      continue;
    }
    graphics.lineStyle(Math.max(1, unit * 0.0014), TWIN_BANKS_PALETTE.fieldLine, 0.2);
    const dx = Math.cos(decoration.angle) * size * 3.8;
    const dy = Math.sin(decoration.angle) * size * 3.8;
    graphics.lineBetween(
      decoration.position.x - dx,
      decoration.position.y - dy,
      decoration.position.x + dx,
      decoration.position.y + dy
    );
  }

  const riverPath = smoothPath(layout.river.centerline, Math.max(4, layout.detailBudget.riverMarks));
  paintRiver(graphics, riverPath, layout.river.width, CIVIL_PALETTE);
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
      center: { x: bridge.center.x + 4, y: bridge.center.y + 6 },
      length: bridge.length,
      width: bridge.width,
      angle: bridge.angle
    });
    graphics.fillStyle(TWIN_BANKS_PALETTE.riverDeep, 0.35);
    tracePolygon(graphics, shadow);
    graphics.fillPath();
    graphics.fillStyle(TWIN_BANKS_PALETTE.bridge, 1);
    tracePolygon(graphics, runwayCorners(bridge));
    graphics.fillPath();
  }
}

function paintScenicRunways(
  graphics: Phaser.GameObjects.Graphics,
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

function paintFacilities(
  graphics: Phaser.GameObjects.Graphics,
  layout: TwinBanksLayout,
  unit: number
): void {
  for (const prop of layout.propAnchors) {
    if (prop.kind === 'windsock') {
      graphics.lineStyle(Math.max(1.4, unit * 0.002), TWIN_BANKS_PALETTE.runwayMarking, 0.6);
      graphics.lineBetween(prop.position.x, prop.position.y, prop.position.x, prop.position.y - prop.size);
      continue;
    }
    paintBuilding(graphics, {
      id: prop.id,
      center: prop.position,
      width: prop.size,
      height: prop.size * (prop.kind === 'hangar' ? 0.52 : 0.68),
      angle: prop.angle,
      kind: prop.kind === 'hangar' ? 'hangar' : 'operations'
    }, CIVIL_PALETTE, layout.runways);
  }

  graphics.lineStyle(Math.max(1.1, unit * 0.0018), TWIN_BANKS_PALETTE.runwayMarking, 0.34);
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
  scene: Phaser.Scene,
  layout: TwinBanksLayout,
  detailLevel: WorldDetailLevel
): void {
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({graphics, unit}) => paintTerrain(graphics, layout, unit),
    operational: ({graphics, unit}) => {
    paintScenicRunways(graphics, layout);
    paintApron(graphics, layout.apron, CIVIL_PALETTE);
    paintApron(graphics, layout.westApron, CIVIL_PALETTE);
    for (const taxiway of layout.taxiways) paintTaxiway(graphics, taxiway, CIVIL_PALETTE);
    for (const runway of layout.runways) {
      paintRunway(graphics, runway, CIVIL_PALETTE, layout.detailBudget.fieldBands);
    }
    paintHelipad(graphics, layout.helipad, CIVIL_PALETTE);
    paintFacilities(graphics, layout, unit);
    },
    detail: () => {}
  }, {materialTextureKey: 'terrain:arcade:meadow'});
}
