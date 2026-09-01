import Phaser from 'phaser';
import type { Vector2 } from '../../core/types';
import type { SaltmarshLayout, SaltmarshVariant } from '../maps/saltmarsh';
import {
  SALTMARSH_PALETTE,
  WORLD_DETAIL_BUDGETS,
  WORLD_LIGHT,
  resolveWorldDetailLevel,
  type WorldDetailLevel
} from '../palette';
import { createAirfieldEnvironmentGeometry } from './AirfieldRenderer';

export interface SaltmarshTerrainPaintOptions {
  detail?: WorldDetailLevel | string;
  detailLevel?: WorldDetailLevel | string;
}

export interface SaltmarshTerrainRenderOptions extends SaltmarshTerrainPaintOptions {
  depth?: number;
}

interface NormalizedChannelPoint {
  readonly x: number;
  readonly y: number;
  /** Width as a fraction of the shorter world dimension. */
  readonly width: number;
}

interface ChannelSample extends Vector2 {
  readonly width: number;
}

interface ChannelShape {
  readonly centerline: readonly ChannelSample[];
  readonly ribbon: readonly Vector2[];
  readonly leftBank: readonly Vector2[];
  readonly rightBank: readonly Vector2[];
}

const MAIN_CHANNELS: Record<SaltmarshVariant, readonly NormalizedChannelPoint[]> = {
  landscape: [
    { x: -0.05, y: 0.79, width: 0.24 },
    { x: 0.1, y: 0.68, width: 0.18 },
    { x: 0.28, y: 0.72, width: 0.13 },
    { x: 0.43, y: 0.64, width: 0.17 },
    { x: 0.58, y: 0.72, width: 0.12 },
    { x: 0.72, y: 0.65, width: 0.16 },
    { x: 0.87, y: 0.75, width: 0.14 },
    { x: 1.06, y: 0.68, width: 0.25 }
  ],
  portrait: [
    { x: -0.06, y: 0.47, width: 0.2 },
    { x: 0.14, y: 0.43, width: 0.14 },
    { x: 0.25, y: 0.54, width: 0.16 },
    { x: 0.18, y: 0.66, width: 0.12 },
    { x: 0.3, y: 0.78, width: 0.16 },
    { x: 0.24, y: 0.9, width: 0.2 },
    { x: 0.39, y: 1.06, width: 0.27 }
  ],
  square: [
    { x: -0.06, y: 0.7, width: 0.22 },
    { x: 0.14, y: 0.62, width: 0.16 },
    { x: 0.32, y: 0.69, width: 0.13 },
    { x: 0.5, y: 0.61, width: 0.16 },
    { x: 0.68, y: 0.72, width: 0.13 },
    { x: 0.85, y: 0.66, width: 0.16 },
    { x: 1.06, y: 0.75, width: 0.24 }
  ]
};

const CREEKS: Record<SaltmarshVariant, readonly (readonly NormalizedChannelPoint[])[]> = {
  landscape: [
    [{ x: 0.11, y: 0.69, width: 0.047 }, { x: 0.065, y: 0.62, width: 0.025 }, { x: 0.105, y: 0.54, width: 0.006 }],
    [{ x: 0.29, y: 0.71, width: 0.041 }, { x: 0.35, y: 0.65, width: 0.023 }, { x: 0.325, y: 0.57, width: 0.006 }],
    [{ x: 0.43, y: 0.65, width: 0.044 }, { x: 0.395, y: 0.59, width: 0.024 }, { x: 0.445, y: 0.515, width: 0.006 }],
    [{ x: 0.57, y: 0.71, width: 0.04 }, { x: 0.625, y: 0.665, width: 0.022 }, { x: 0.69, y: 0.6, width: 0.005 }],
    [{ x: 0.72, y: 0.66, width: 0.043 }, { x: 0.69, y: 0.59, width: 0.023 }, { x: 0.75, y: 0.535, width: 0.006 }],
    [{ x: 0.86, y: 0.74, width: 0.038 }, { x: 0.92, y: 0.695, width: 0.02 }, { x: 0.955, y: 0.615, width: 0.005 }],
    [{ x: 0.36, y: 0.68, width: 0.033 }, { x: 0.3, y: 0.735, width: 0.018 }, { x: 0.255, y: 0.82, width: 0.005 }]
  ],
  portrait: [
    [{ x: 0.14, y: 0.45, width: 0.043 }, { x: 0.225, y: 0.455, width: 0.023 }, { x: 0.315, y: 0.5, width: 0.006 }],
    [{ x: 0.23, y: 0.55, width: 0.04 }, { x: 0.32, y: 0.585, width: 0.022 }, { x: 0.395, y: 0.545, width: 0.006 }],
    [{ x: 0.19, y: 0.67, width: 0.043 }, { x: 0.285, y: 0.65, width: 0.023 }, { x: 0.36, y: 0.695, width: 0.006 }],
    [{ x: 0.29, y: 0.78, width: 0.04 }, { x: 0.37, y: 0.8, width: 0.021 }, { x: 0.445, y: 0.755, width: 0.005 }],
    [{ x: 0.24, y: 0.9, width: 0.044 }, { x: 0.33, y: 0.915, width: 0.023 }, { x: 0.405, y: 0.87, width: 0.006 }],
    [{ x: 0.27, y: 0.73, width: 0.034 }, { x: 0.17, y: 0.75, width: 0.018 }, { x: 0.085, y: 0.81, width: 0.005 }],
    [{ x: 0.31, y: 0.84, width: 0.031 }, { x: 0.245, y: 0.91, width: 0.016 }, { x: 0.18, y: 0.965, width: 0.005 }]
  ],
  square: [
    [{ x: 0.13, y: 0.63, width: 0.044 }, { x: 0.09, y: 0.565, width: 0.023 }, { x: 0.15, y: 0.5, width: 0.006 }],
    [{ x: 0.31, y: 0.68, width: 0.04 }, { x: 0.365, y: 0.615, width: 0.022 }, { x: 0.33, y: 0.55, width: 0.005 }],
    [{ x: 0.5, y: 0.62, width: 0.043 }, { x: 0.555, y: 0.575, width: 0.023 }, { x: 0.62, y: 0.53, width: 0.006 }],
    [{ x: 0.67, y: 0.71, width: 0.04 }, { x: 0.73, y: 0.67, width: 0.021 }, { x: 0.785, y: 0.61, width: 0.005 }],
    [{ x: 0.84, y: 0.67, width: 0.037 }, { x: 0.89, y: 0.62, width: 0.019 }, { x: 0.875, y: 0.555, width: 0.005 }],
    [{ x: 0.39, y: 0.66, width: 0.033 }, { x: 0.34, y: 0.75, width: 0.017 }, { x: 0.39, y: 0.825, width: 0.005 }],
    [{ x: 0.72, y: 0.71, width: 0.031 }, { x: 0.67, y: 0.79, width: 0.016 }, { x: 0.72, y: 0.855, width: 0.005 }]
  ]
};

const MUDFLATS: Record<SaltmarshVariant, readonly (readonly (readonly [number, number])[])[]> = {
  landscape: [
    [[0.03, 0.78], [0.14, 0.7], [0.25, 0.73], [0.2, 0.82], [0.08, 0.87]],
    [[0.45, 0.72], [0.58, 0.69], [0.68, 0.75], [0.61, 0.83], [0.49, 0.81]],
    [[0.78, 0.76], [0.9, 0.73], [1.0, 0.79], [0.94, 0.87], [0.82, 0.85]]
  ],
  portrait: [
    [[0.02, 0.5], [0.13, 0.46], [0.23, 0.52], [0.18, 0.61], [0.07, 0.62]],
    [[0.16, 0.69], [0.27, 0.7], [0.34, 0.78], [0.27, 0.85], [0.16, 0.8]],
    [[0.18, 0.88], [0.3, 0.88], [0.38, 0.96], [0.29, 1.01], [0.17, 0.97]]
  ],
  square: [
    [[0.02, 0.71], [0.14, 0.64], [0.26, 0.68], [0.21, 0.78], [0.08, 0.82]],
    [[0.43, 0.68], [0.55, 0.64], [0.67, 0.71], [0.6, 0.8], [0.48, 0.78]],
    [[0.77, 0.72], [0.89, 0.68], [1.0, 0.75], [0.94, 0.84], [0.82, 0.82]]
  ]
};

function deterministicUnit(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x27d4eb2d) ^ Math.imul(salt + 23, 0x165667b1);
  value ^= value >>> 15;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 0xffffffff;
}

function tracePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 3) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
}

function strokePolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.strokePath();
}

function normalizedPolygon(
  layout: SaltmarshLayout,
  points: readonly (readonly [number, number])[]
): Vector2[] {
  return points.map(([x, y]) => ({ x: x * layout.width, y: y * layout.height }));
}

function catmullRom(value0: number, value1: number, value2: number, value3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * value1 +
    (-value0 + value2) * t +
    (2 * value0 - 5 * value1 + 4 * value2 - value3) * t2 +
    (-value0 + 3 * value1 - 3 * value2 + value3) * t3
  );
}

function sampleChannel(
  layout: SaltmarshLayout,
  anchors: readonly NormalizedChannelPoint[],
  subdivisions: number
): ChannelSample[] {
  const unit = Math.min(layout.width, layout.height);
  const points = anchors.map((point) => ({
    x: point.x * layout.width,
    y: point.y * layout.height,
    width: point.width * unit
  }));
  const samples: ChannelSample[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const finish = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step < subdivisions; step += 1) {
      const progress = step / subdivisions;
      samples.push({
        x: catmullRom(previous.x, start.x, finish.x, next.x, progress),
        y: catmullRom(previous.y, start.y, finish.y, next.y, progress),
        width: Math.max(2, catmullRom(previous.width, start.width, finish.width, next.width, progress))
      });
    }
  }
  samples.push(points[points.length - 1]);
  return samples;
}

function channelShape(samples: readonly ChannelSample[], extraWidth = 0): ChannelShape {
  const leftBank: Vector2[] = [];
  const rightBank: Vector2[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const length = Math.max(0.001, Math.hypot(next.x - previous.x, next.y - previous.y));
    const normalX = -(next.y - previous.y) / length;
    const normalY = (next.x - previous.x) / length;
    const halfWidth = samples[index].width / 2 + extraWidth;
    leftBank.push({
      x: samples[index].x + normalX * halfWidth,
      y: samples[index].y + normalY * halfWidth
    });
    rightBank.push({
      x: samples[index].x - normalX * halfWidth,
      y: samples[index].y - normalY * halfWidth
    });
  }
  return {
    centerline: samples,
    leftBank,
    rightBank,
    ribbon: [...leftBank, ...rightBank.slice().reverse()]
  };
}

function pointInPolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const first = polygon[index];
    const second = polygon[previous];
    const crosses = (first.y > point.y) !== (second.y > point.y) &&
      point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function paintChannel(
  graphics: Phaser.GameObjects.Graphics,
  shape: ChannelShape,
  shallowShape: ChannelShape,
  prominence = 1
): void {
  graphics.fillStyle(SALTMARSH_PALETTE.waterShallow, 0.78 * prominence);
  tracePolygon(graphics, shallowShape.ribbon);
  graphics.fillPath();
  graphics.fillStyle(SALTMARSH_PALETTE.waterDeep, 0.82 + 0.18 * prominence);
  tracePolygon(graphics, shape.ribbon);
  graphics.fillPath();
  graphics.lineStyle(1.25, SALTMARSH_PALETTE.saltFilm, 0.11 * prominence);
  strokePolyline(graphics, shallowShape.leftBank);
  strokePolyline(graphics, shallowShape.rightBank);
}

function paintMudflats(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  detail: WorldDetailLevel
): void {
  const flats = MUDFLATS[layout.variant];
  const limit = detail === 'mobile' ? 2 : flats.length;
  for (let index = 0; index < limit; index += 1) {
    const polygon = normalizedPolygon(layout, flats[index]);
    graphics.fillStyle(SALTMARSH_PALETTE.wetMud, 0.27);
    tracePolygon(graphics, polygon);
    graphics.fillPath();
    graphics.lineStyle(1, SALTMARSH_PALETTE.silt, 0.11);
    strokePolyline(graphics, [...polygon, polygon[0]]);
  }

  if (detail !== 'desktop') return;
  // Salt films sit in irregular pans instead of decorative standalone ovals.
  const unit = Math.min(layout.width, layout.height);
  for (let index = 0; index < 5; index += 1) {
    const center = {
      x: layout.width * (0.08 + deterministicUnit(index, 41) * 0.34),
      y: layout.height * (0.16 + deterministicUnit(index, 73) * 0.28)
    };
    const radius = unit * (0.012 + deterministicUnit(index, 93) * 0.013);
    const pan: Vector2[] = [];
    for (let corner = 0; corner < 7; corner += 1) {
      const angle = (corner / 7) * Math.PI * 2;
      const variation = 0.72 + deterministicUnit(index * 7 + corner, 117) * 0.5;
      pan.push({
        x: center.x + Math.cos(angle) * radius * variation * 1.7,
        y: center.y + Math.sin(angle) * radius * variation
      });
    }
    graphics.fillStyle(SALTMARSH_PALETTE.saltFilm, 0.07);
    tracePolygon(graphics, pan);
    graphics.fillPath();
  }
}

function paintSedimentBands(
  graphics: Phaser.GameObjects.Graphics,
  shape: ChannelShape,
  bandCount: number,
  unit: number
): void {
  const banks = [shape.leftBank, shape.rightBank];
  graphics.lineStyle(Math.max(1.2, unit * 0.0024), SALTMARSH_PALETTE.silt, 0.22);
  for (let index = 0; index < bandCount; index += 1) {
    const bank = banks[index % banks.length];
    const usable = Math.max(2, bank.length - 8);
    const start = 3 + Math.floor(deterministicUnit(index, 151) * usable * 0.75);
    const span = 3 + Math.floor(deterministicUnit(index, 167) * 6);
    strokePolyline(graphics, bank.slice(start, Math.min(bank.length, start + span)));
  }
}

function paintReedClumps(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  detail: WorldDetailLevel,
  exclusions: readonly (readonly Vector2[])[]
): void {
  const budget = WORLD_DETAIL_BUDGETS[detail];
  const unit = Math.min(layout.width, layout.height);
  const anchors: Vector2[] = [];
  const attempts = budget.reedClumps * 10;
  for (let attempt = 0; attempt < attempts && anchors.length < budget.reedClumps; attempt += 1) {
    const point = {
      x: deterministicUnit(attempt, layout.variant === 'portrait' ? 211 : 223) * layout.width,
      y: deterministicUnit(attempt, layout.variant === 'square' ? 241 : 251) * layout.height
    };
    if (exclusions.some((polygon) => pointInPolygon(point, polygon))) continue;
    anchors.push(point);
  }

  const shadowX = WORLD_LIGHT.lowShadow.x * Math.max(0.75, unit / 900);
  const shadowY = WORLD_LIGHT.lowShadow.y * Math.max(0.75, unit / 900);
  for (let clump = 0; clump < anchors.length; clump += 1) {
    const anchor = anchors[clump];
    for (let blade = 0; blade < budget.bladesPerClump; blade += 1) {
      const angle = deterministicUnit(clump * 7 + blade, 277) * Math.PI * 2;
      const spread = unit * (0.002 + deterministicUnit(clump * 11 + blade, 293) * 0.006);
      const base = {
        x: anchor.x + Math.cos(angle) * spread,
        y: anchor.y + Math.sin(angle) * spread * 0.72
      };
      const length = unit * (0.005 + deterministicUnit(clump * 13 + blade, 307) * 0.006);
      const tip = { x: base.x + length * 0.72, y: base.y - length * 0.42 };
      graphics.lineStyle(Math.max(0.8, unit * 0.00115), SALTMARSH_PALETTE.polderShadow, 0.12);
      graphics.lineBetween(base.x + shadowX, base.y + shadowY, tip.x + shadowX, tip.y + shadowY);
      graphics.lineStyle(
        Math.max(0.8, unit * 0.0011),
        blade % 3 === 0 ? SALTMARSH_PALETTE.reedLight : SALTMARSH_PALETTE.reedDark,
        0.34
      );
      graphics.lineBetween(base.x, base.y, tip.x, tip.y);
    }
  }
}

/** Paint deterministic coastal geography into a caller-owned static layer. */
export function paintSaltmarshTerrain(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  options: SaltmarshTerrainPaintOptions = {}
): void {
  const detail = resolveWorldDetailLevel(options.detailLevel ?? options.detail);
  const budget = WORLD_DETAIL_BUDGETS[detail];
  const unit = Math.min(layout.width, layout.height);
  const subdivisions = detail === 'mobile' ? 6 : detail === 'tablet' ? 8 : 11;

  graphics.fillStyle(SALTMARSH_PALETTE.marshDeep, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);
  graphics.fillStyle(SALTMARSH_PALETTE.marsh, 0.38);
  graphics.fillRect(0, 0, layout.width, layout.height);

  const mainSamples = sampleChannel(layout, MAIN_CHANNELS[layout.variant], subdivisions);
  const main = channelShape(mainSamples);
  const mainShelf = channelShape(mainSamples, unit * 0.032);
  paintChannel(graphics, main, mainShelf);
  paintMudflats(graphics, layout, detail);

  const creekShapes: ChannelShape[] = [];
  for (const creek of CREEKS[layout.variant].slice(0, budget.creekCount)) {
    const samples = sampleChannel(layout, creek, Math.max(4, subdivisions - 2));
    const shape = channelShape(samples);
    const shelf = channelShape(samples, unit * 0.008);
    paintChannel(graphics, shape, shelf, 0.64);
    creekShapes.push(shelf);
  }

  paintSedimentBands(graphics, mainShelf, budget.sedimentBands, unit);
  const airfield = createAirfieldEnvironmentGeometry(layout);
  paintReedClumps(graphics, layout, detail, [
    mainShelf.ribbon,
    airfield.outerPolder,
    ...airfield.approachClearZones,
    ...creekShapes.map((shape) => shape.ribbon)
  ]);
}

/** Convenience retained renderer; compositors should prefer the paint function. */
export function renderSaltmarshTerrain(
  scene: Phaser.Scene,
  layout: SaltmarshLayout,
  options: SaltmarshTerrainRenderOptions = {}
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(options.depth ?? -20);
  paintSaltmarshTerrain(graphics, layout, options);
  return graphics;
}
