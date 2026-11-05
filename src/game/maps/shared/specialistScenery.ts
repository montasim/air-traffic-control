import type Phaser from 'phaser';
import type { Vector2 } from '../../../core/types';
import {
  clearOfAirfield,
  convexHull,
  deterministicUnit,
  mixColor,
  paintCanopy,
  paintRaisedBuilding,
  raggedOutline,
  strokePolyline,
  tracePolygon,
  type CivilMapPalette,
  type MapBuilding,
} from '../../rendering/shared-map';
import type { SpecialistLayout } from './specialistAirfield';

/**
 * The signature landscape of each specialist field, so no two of them look alike: a railway
 * junction with freight trains, the edge of a city with a busy motorway, a coastal headland with
 * a marina and golf course, and wooded hills around a fenced military base. Everything keeps
 * clear of the runways, aprons and pads.
 */

type Graphics = Phaser.GameObjects.Graphics;
/** A straight strip across the map: its two ends and its direction. */
interface Corridor { readonly from: Vector2; readonly to: Vector2; readonly angle: number; readonly length: number }

const unitOf = (layout: SpecialistLayout) => Math.min(layout.width, layout.height);
const lerp = (a: Vector2, b: Vector2, t: number): Vector2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const fill = (graphics: Graphics, points: readonly Vector2[], color: number, alpha = 1) => {
  graphics.fillStyle(color, alpha);
  tracePolygon(graphics, points);
  graphics.fillPath();
};
/** A rectangle centred on `center`, `length` along `angle` and `width` across it. */
const box = (center: Vector2, length: number, width: number, angle: number): Vector2[] => {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: center.x + (a * length * c) / 2 - (b * width * s) / 2, y: center.y + (a * length * s) / 2 + (b * width * c) / 2 }));
};
/** A point `along` the corridor and `across` it (positive to the corridor's right). */
const onCorridor = (corridor: Corridor, along: number, across: number): Vector2 => {
  const [c, s] = [Math.cos(corridor.angle), Math.sin(corridor.angle)];
  return { x: corridor.from.x + c * along - s * across, y: corridor.from.y + s * along + c * across };
};

/**
 * The first straight strip of `halfWidth` either side that crosses the whole map well clear of the
 * airfield: tried along the bottom and top edges, then the left and right ones, a little further
 * in each time.
 */
function findCorridor(layout: SpecialistLayout, halfWidth: number): Corridor | undefined {
  const { width: w, height: h } = layout;
  const unit = unitOf(layout);
  const candidates: [Vector2, Vector2][] = [];
  for (const share of [0.93, 0.07, 0.88, 0.12, 0.83, 0.17]) candidates.push([{ x: -unit * 0.1, y: h * share }, { x: w + unit * 0.1, y: h * share }]);
  for (const share of [0.06, 0.94, 0.11, 0.89, 0.16, 0.84]) candidates.push([{ x: w * share, y: -unit * 0.1 }, { x: w * share, y: h + unit * 0.1 }]);
  for (const [from, to] of candidates) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.ceil(length / (unit * 0.02));
    let clear = true;
    for (let i = 0; i <= steps && clear; i += 1) clear = clearOfAirfield(layout, lerp(from, to, i / steps), halfWidth + unit * 0.03);
    if (clear) return { from, to, angle: Math.atan2(to.y - from.y, to.x - from.x), length };
  }
  return undefined;
}

/** Whether a circle stays clear of the airfield and inside the map. */
const freeAt = (layout: SpecialistLayout, point: Vector2, radius: number) =>
  point.x > radius * 0.3 && point.y > radius * 0.3 && point.x < layout.width - radius * 0.3 && point.y < layout.height - radius * 0.3 && clearOfAirfield(layout, point, radius);

/** Runs `step` each frame until the graphics are cleared away (as between map previews or a new shift). */
function animate(scene: Phaser.Scene, graphics: Graphics, draw: (seconds: number) => void): void {
  draw(4);
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let clock = 4;
  const step = (_time: number, delta: number) => {
    if (!graphics.scene) return void scene.events.off('update', step);
    clock += delta / 1000;
    draw(clock);
  };
  scene.events.on('update', step);
  scene.events.once('shutdown', () => scene.events.off('update', step));
}

// ─── Freight Junction: a railway junction ────────────────────────────────────────────────────

const RAIL = { ballast: 0x8d8475, ballastEdge: 0x6f6759, sleeper: 0x5a4a3c, rail: 0x3b3d3e };
const WAGON_COLORS = [0x9b4f34, 0x3f6d8f, 0x5d7c4a, 0xa88c55, 0x7a7f84, 0xb4652e];

function paintTrack(graphics: Graphics, from: Vector2, to: Vector2, unit: number): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const gauge = unit * 0.006;
  graphics.lineStyle(Math.max(1, unit * 0.0022), RAIL.sleeper, 0.9);
  for (let d = 0; d < length; d += unit * 0.006) {
    const p = { x: from.x + c * d, y: from.y + s * d };
    graphics.lineBetween(p.x + s * gauge * 1.6, p.y - c * gauge * 1.6, p.x - s * gauge * 1.6, p.y + c * gauge * 1.6);
  }
  graphics.lineStyle(Math.max(1, unit * 0.0018), RAIL.rail, 1);
  for (const side of [-1, 1]) strokePolyline(graphics, [{ x: from.x + s * gauge * side, y: from.y - c * gauge * side }, { x: to.x + s * gauge * side, y: to.y - c * gauge * side }]);
}

interface Railway { readonly main: Corridor; readonly tracks: readonly number[]; readonly unit: number }

/** A double-track main line along a clear edge, a rail yard of sidings with wagons, and a stack of containers. */
export function paintRailway(graphics: Graphics, layout: SpecialistLayout): Railway | undefined {
  const unit = unitOf(layout);
  const main = findCorridor(layout, unit * 0.03);
  if (!main) return undefined;
  const tracks = [-unit * 0.011, unit * 0.011];
  // Ballast bed under both tracks.
  fill(graphics, box(lerp(main.from, main.to, 0.5), main.length, unit * 0.05, main.angle), RAIL.ballastEdge, 0.9);
  fill(graphics, box(lerp(main.from, main.to, 0.5), main.length, unit * 0.04, main.angle), RAIL.ballast, 1);
  for (const across of tracks) paintTrack(graphics, onCorridor(main, 0, across), onCorridor(main, main.length, across), unit);
  // The yard: sidings on the side toward the map's middle, wherever they stay clear.
  const middle = { x: layout.width / 2, y: layout.height / 2 };
  const [right, left] = [onCorridor(main, main.length / 2, unit * 0.1), onCorridor(main, main.length / 2, -unit * 0.1)];
  const inward = Math.hypot(right.x - middle.x, right.y - middle.y) < Math.hypot(left.x - middle.x, left.y - middle.y) ? 1 : -1;
  const sidings: [number, number, number][] = [];
  for (const k of [1, 2, 3, 4]) {
    const across = inward * (unit * 0.035 + k * unit * 0.022);
    const [start, end] = [main.length * 0.12, main.length * 0.5];
    let clear = true;
    for (let d = start; d <= end && clear; d += unit * 0.02) clear = freeAt(layout, onCorridor(main, d, across), unit * 0.03);
    if (!clear) break;
    sidings.push([across, start, end]);
  }
  if (sidings.length) {
    const outer = sidings[sidings.length - 1][0];
    const yardCenter = onCorridor(main, main.length * 0.31, (inward * unit * 0.035 + outer) / 2);
    fill(graphics, box(yardCenter, main.length * 0.42, Math.abs(outer) - unit * 0.02, main.angle), RAIL.ballast, 0.85);
    sidings.forEach(([across, start, end], k) => {
      paintTrack(graphics, onCorridor(main, start, across), onCorridor(main, end, across), unit);
      // A switch back to the main line at the yard throat.
      paintTrack(graphics, onCorridor(main, start - unit * 0.05, tracks[inward > 0 ? 1 : 0]), onCorridor(main, start, across), unit);
      // A rake of wagons standing on each siding, with gaps.
      for (let d = start + unit * 0.02, n = 0; d < end - unit * 0.03; d += unit * 0.034, n += 1) {
        if (deterministicUnit(k * 31 + n, 811) < 0.22) continue;
        const color = WAGON_COLORS[Math.floor(deterministicUnit(k * 31 + n, 813) * WAGON_COLORS.length)];
        const wagon = box(onCorridor(main, d, across), unit * 0.03, unit * 0.011, main.angle);
        fill(graphics, wagon.map((p) => ({ x: p.x + unit * 0.002, y: p.y + unit * 0.003 })), 0x2d3a33, 0.3);
        fill(graphics, wagon, color);
        fill(graphics, box(onCorridor(main, d, across), unit * 0.026, unit * 0.004, main.angle), mixColor(color, 0xffffff, 0.25), 0.8);
      }
    });
    // A container stack yard beyond the sidings: rows of stacked boxes in shipping colours.
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 8; col += 1) {
      const across = outer + inward * (unit * 0.035 + row * unit * 0.016);
      const at = onCorridor(main, main.length * 0.14 + col * unit * 0.034, across);
      if (!freeAt(layout, at, unit * 0.025)) continue;
      const color = WAGON_COLORS[Math.floor(deterministicUnit(row * 17 + col, 821) * WAGON_COLORS.length)];
      const container = box(at, unit * 0.03, unit * 0.012, main.angle);
      fill(graphics, container.map((p) => ({ x: p.x + unit * 0.003, y: p.y + unit * 0.004 })), 0x2d3a33, 0.3);
      fill(graphics, container, color);
      graphics.lineStyle(1, mixColor(color, 0x000000, 0.25), 0.7);
      for (const t of [-0.25, 0, 0.25]) {
        const [a, b] = [onCorridor(main, main.length * 0.14 + col * unit * 0.034 + t * unit * 0.03, across - unit * 0.006), onCorridor(main, main.length * 0.14 + col * unit * 0.034 + t * unit * 0.03, across + unit * 0.006)];
        graphics.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }
  return { main, tracks, unit };
}

/** Freight trains running through on the main line, one each way, with long gaps between them. */
export function addFreightTrains(scene: Phaser.Scene, railway: Railway | undefined, depth = -19.6): void {
  if (!railway || !scene.add?.graphics) return;
  const { main, tracks, unit } = railway;
  const graphics = scene.add.graphics().setDepth(depth);
  const wagons = 16;
  const wagonLength = unit * 0.032;
  const trainLength = (wagons + 1) * wagonLength;
  const lap = main.length + trainLength;
  const speed = unit * 0.09;
  animate(scene, graphics, (seconds) => {
    graphics.clear();
    tracks.forEach((across, index) => {
      // Each train runs its lap, then the line stays empty for a while before the next.
      const cycle = lap / speed + 9;
      const t = ((seconds + index * cycle * 0.5) % cycle) * speed;
      if (t > lap) return;
      const direction = index ? -1 : 1;
      for (let k = 0; k <= wagons; k += 1) {
        const head = direction > 0 ? t - k * wagonLength : main.length - t + k * wagonLength;
        if (head < -wagonLength || head > main.length + wagonLength) continue;
        const center = onCorridor(main, head, across);
        const loco = k === 0;
        const color = loco ? 0xd8a03a : WAGON_COLORS[(k * 7 + index * 3) % WAGON_COLORS.length];
        const body = box(center, wagonLength * 0.9, unit * 0.012, main.angle);
        fill(graphics, body.map((p) => ({ x: p.x + unit * 0.002, y: p.y + unit * 0.003 })), 0x1f2a24, 0.3);
        fill(graphics, body, color);
        fill(graphics, box(center, wagonLength * (loco ? 0.4 : 0.8), unit * (loco ? 0.008 : 0.004), main.angle), loco ? 0x3b3f42 : mixColor(color, 0xffffff, 0.25), 0.85);
      }
    });
  });
}

// ─── Metro International: the edge of the city ──────────────────────────────────────────────

const CAR_COLORS = [0xe9e6dc, 0xc4453a, 0x3f6d9a, 0x2f3437, 0xd9b247, 0x8f969a, 0x4f7a5a];

/** A dual carriageway along a clear edge: two roadways, a green median, edge and lane lines. */
export function paintMotorway(graphics: Graphics, layout: SpecialistLayout): Corridor | undefined {
  const unit = unitOf(layout);
  const road = findCorridor(layout, unit * 0.034);
  if (!road) return undefined;
  const middle = lerp(road.from, road.to, 0.5);
  fill(graphics, box(middle, road.length, unit * 0.07, road.angle), 0x9a9c8e, 0.8);
  fill(graphics, box(middle, road.length, unit * 0.062, road.angle), 0x4a5154);
  fill(graphics, box(middle, road.length, unit * 0.007, road.angle), 0x5f7d4f);
  graphics.lineStyle(Math.max(1, unit * 0.0016), 0xe8e4d4, 0.85);
  for (const across of [-0.029, 0.029, -0.005, 0.005]) strokePolyline(graphics, [onCorridor(road, 0, unit * across), onCorridor(road, road.length, unit * across)]);
  graphics.lineStyle(Math.max(1, unit * 0.0014), 0xe8e4d4, 0.7);
  for (const across of [-0.017, 0.017]) for (let d = 0; d < road.length; d += unit * 0.03) {
    const [a, b] = [onCorridor(road, d, unit * across), onCorridor(road, d + unit * 0.014, unit * across)];
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  return road;
}

/** Traffic on the motorway: cars and the odd lorry in each lane, each lane at its own pace. */
export function addMotorwayTraffic(scene: Phaser.Scene, road: Corridor | undefined, unit: number, depth = -19.6): void {
  if (!road || !scene.add?.graphics) return;
  const graphics = scene.add.graphics().setDepth(depth);
  const lanes = [
    { across: -0.023, direction: 1, speed: 0.16 }, { across: -0.011, direction: 1, speed: 0.12 },
    { across: 0.011, direction: -1, speed: 0.13 }, { across: 0.023, direction: -1, speed: 0.17 },
  ];
  const perLane = 7;
  animate(scene, graphics, (seconds) => {
    graphics.clear();
    lanes.forEach((lane, l) => {
      for (let i = 0; i < perLane; i += 1) {
        const seed = l * 50 + i;
        const lorry = deterministicUnit(seed, 831) < 0.18;
        const spacing = road.length / perLane;
        const travelled = (seconds * unit * lane.speed + i * spacing + deterministicUnit(seed, 833) * spacing * 0.6) % road.length;
        const along = lane.direction > 0 ? travelled : road.length - travelled;
        const center = onCorridor(road, along, unit * lane.across);
        const length = unit * (lorry ? 0.026 : 0.013);
        const body = box(center, length, unit * (lorry ? 0.008 : 0.0065), road.angle);
        const color = lorry ? 0xe2ddd0 : CAR_COLORS[Math.floor(deterministicUnit(seed, 835) * CAR_COLORS.length)];
        fill(graphics, body, color);
        // The windscreen at the front, so cars read as facing their way.
        const front = onCorridor(road, along + lane.direction * length * 0.18, unit * lane.across);
        fill(graphics, box(front, length * (lorry ? 0.15 : 0.22), unit * 0.005, road.angle), 0x26323a, 0.85);
      }
    });
  });
}

const ROOFS = [0xb7b2a6, 0xa98f7a, 0x9aa3a6, 0xc4bba8, 0x8f8a82, 0xb59b80, 0xd0c8b8];

/**
 * A city district on the largest open ground clear of the airfield and the on-screen panels: a grid of blocks between
 * streets, filled with buildings of mixed sizes and roofs, a few taller towers near its heart,
 * and street trees.
 */
export function paintCityDistrict(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const cell = unit * 0.06;
  const cells: Vector2[] = [];
  for (let x = cell / 2; x < layout.width; x += cell) for (let y = cell / 2; y < layout.height; y += cell) {
    const at = { x, y };
    const underPanel = layout.hudExclusionZones.some((zone) => x > zone.x - cell && x < zone.x + zone.width + cell && y > zone.y - cell && y < zone.y + zone.height + cell);
    if (!underPanel && freeAt(layout, at, cell * 0.8) && !avoid(at, cell * 0.6)) cells.push(at);
  }
  if (!cells.length) return () => false;
  const reach = unit * 0.34;
  // The heart is where the most open blocks lie within reach, so the district fills real space.
  const around = (at: Vector2) => cells.filter((other) => Math.hypot(other.x - at.x, other.y - at.y) < reach).length;
  const heart = cells.reduce((best, at) => (around(at) > around(best) ? at : best));
  const district = cells.filter((at) => Math.hypot(at.x - heart.x, at.y - heart.y) < reach);
  // Streets: the ground between blocks, then each block's own paving.
  for (const at of district) fill(graphics, box(at, cell * 1.02, cell * 1.02, 0), 0x6f7468, 0.95);
  district.forEach((at, i) => {
    fill(graphics, box(at, cell * 0.78, cell * 0.78, 0), 0x9a9b8d);
    const toward = Math.hypot(at.x - heart.x, at.y - heart.y) / reach;
    const tower = toward < 0.3 && deterministicUnit(i, 841) < 0.6;
    const parts = tower ? 1 : 2 + Math.floor(deterministicUnit(i, 843) * 3);
    for (let k = 0; k < parts; k += 1) {
      const quarter = parts === 1 ? { x: 0, y: 0 } : { x: (k % 2 ? 1 : -1) * cell * 0.18, y: (k < 2 ? -1 : 1) * cell * 0.18 * (parts > 2 ? 1 : 0) };
      const size = tower ? cell * 0.62 : cell * (0.24 + deterministicUnit(i * 5 + k, 845) * 0.14);
      const roof = ROOFS[Math.floor(deterministicUnit(i * 5 + k, 847) * ROOFS.length)];
      const building: MapBuilding = { id: `city-${i}-${k}`, center: { x: at.x + quarter.x, y: at.y + quarter.y }, width: size, height: size * (0.75 + deterministicUnit(i * 5 + k, 849) * 0.4), angle: 0, kind: tower ? 'hangar' : 'operations' };
      paintRaisedBuilding(graphics, building, { ...palette, building: roof, buildingRoof: mixColor(roof, 0xffffff, 0.35) }, unit * (tower ? 1.8 : 0.9));
    }
  });
  // Street trees along the edge of the district.
  const crowns = district.filter((_, i) => deterministicUnit(i, 851) < 0.45).map((at, i) => ({ x: at.x + cell * 0.46, y: at.y + (deterministicUnit(i, 853) - 0.5) * cell * 0.6, r: unit * 0.007 }));
  paintCanopy(graphics, crowns, palette);
  return (point, radius) => district.some((at) => Math.hypot(at.x - point.x, at.y - point.y) < cell * 0.75 + radius);
}

// ─── Executive Point: a coastal headland ────────────────────────────────────────────────────

/** The sea along the edge farthest from the airfield, its beach and surf, a marina and a lighthouse. Returns the sea outline. */
export function paintCoast(graphics: Graphics, layout: SpecialistLayout): Vector2[] | undefined {
  const { width: w, height: h } = layout;
  const unit = unitOf(layout);
  const terminal = layout.buildings[0].center;
  // The edge farthest from the terminal.
  const edges = [
    { side: 'left', gap: terminal.x }, { side: 'right', gap: w - terminal.x },
    { side: 'top', gap: terminal.y }, { side: 'bottom', gap: h - terminal.y },
  ].sort((a, b) => b.gap - a.gap);
  for (const { side } of edges) {
    for (let depth = unit * 0.2; depth >= unit * 0.09; depth -= unit * 0.02) {
      const along = side === 'left' || side === 'right' ? h : w;
      const shore: Vector2[] = [];
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const inset = depth * (0.75 + 0.35 * Math.sin(t * Math.PI * 2.3 + 1) * deterministicUnit(i, 861));
        const s = t * along;
        shore.push(side === 'left' ? { x: inset, y: s } : side === 'right' ? { x: w - inset, y: s } : side === 'top' ? { x: s, y: inset } : { x: s, y: h - inset });
      }
      if (!shore.every((p) => clearOfAirfield(layout, p, unit * 0.05))) continue;
      const corners = side === 'left' ? [{ x: -10, y: h + 10 }, { x: -10, y: -10 }] : side === 'right' ? [{ x: w + 10, y: h + 10 }, { x: w + 10, y: -10 }] : side === 'top' ? [{ x: w + 10, y: -10 }, { x: -10, y: -10 }] : [{ x: w + 10, y: h + 10 }, { x: -10, y: h + 10 }];
      const sea = raggedOutline([...shore, ...corners], unit);
      // Beach, shallows, deep water and the line of surf.
      graphics.lineStyle(unit * 0.05, 0xe2d3a6, 1);
      tracePolygon(graphics, sea);
      graphics.strokePath();
      fill(graphics, sea, 0x3f87a6);
      graphics.lineStyle(unit * 0.03, 0x7fbccc, 0.9);
      tracePolygon(graphics, sea);
      graphics.strokePath();
      graphics.lineStyle(Math.max(1.5, unit * 0.004), 0xf4fbfb, 0.8);
      tracePolygon(graphics, sea);
      graphics.strokePath();
      paintMarina(graphics, shore, side, unit);
      return sea;
    }
  }
  return undefined;
}

function paintMarina(graphics: Graphics, shore: readonly Vector2[], side: string, unit: number): void {
  const seaward = side === 'left' ? { x: -1, y: 0 } : side === 'right' ? { x: 1, y: 0 } : side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const alongShore = { x: Math.abs(seaward.y), y: Math.abs(seaward.x) };
  // Three wooden jetties reaching out from the shore, a third of the way along.
  const base = shore[4];
  for (let j = 0; j < 3; j += 1) {
    const root = { x: base.x + alongShore.x * j * unit * 0.05, y: base.y + alongShore.y * j * unit * 0.05 };
    const tip = { x: root.x + seaward.x * unit * 0.085, y: root.y + seaward.y * unit * 0.085 };
    graphics.lineStyle(Math.max(1.5, unit * 0.004), 0xb79a72, 1);
    graphics.lineBetween(root.x, root.y, tip.x, tip.y);
    // Yachts moored either side, bows toward open water.
    for (let k = 1; k <= 3; k += 1) for (const s of [-1, 1]) {
      if (deterministicUnit(j * 7 + k * 2 + (s > 0 ? 1 : 0), 871) < 0.25) continue;
      const at = { x: root.x + seaward.x * unit * 0.025 * k + alongShore.x * s * unit * 0.011, y: root.y + seaward.y * unit * 0.025 * k + alongShore.y * s * unit * 0.011 };
      const angle = Math.atan2(seaward.y, seaward.x);
      const hull = [[-0.5, -0.32], [0.2, -0.38], [0.5, 0], [0.2, 0.38], [-0.5, 0.32]].map(([a, b]) => ({
        x: at.x + Math.cos(angle) * a * unit * 0.02 - Math.sin(angle) * b * unit * 0.009,
        y: at.y + Math.sin(angle) * a * unit * 0.02 + Math.cos(angle) * b * unit * 0.009,
      }));
      fill(graphics, hull.map((p) => ({ x: p.x + unit * 0.002, y: p.y + unit * 0.003 })), 0x1f4a5a, 0.35);
      fill(graphics, hull, 0xf6f4ee);
      fill(graphics, box(at, unit * 0.007, unit * 0.005, angle), 0x9fb5bd);
    }
  }
  // A lighthouse at the far end of the shore: white tower, red band, and its shadow.
  const light = { x: shore[12].x - seaward.x * unit * 0.02, y: shore[12].y - seaward.y * unit * 0.02 };
  graphics.fillStyle(0x2d3a33, 0.3);
  graphics.fillEllipse(light.x + unit * 0.02, light.y + unit * 0.016, unit * 0.04, unit * 0.014);
  graphics.fillStyle(0xf4f1e8, 1);
  graphics.fillCircle(light.x, light.y, unit * 0.011);
  graphics.lineStyle(Math.max(1.5, unit * 0.004), 0xc4453a, 1);
  graphics.strokeCircle(light.x, light.y, unit * 0.007);
  graphics.fillStyle(0xffe9a8, 1);
  graphics.fillCircle(light.x, light.y, unit * 0.003);
}

/** A golf course on open ground: fairways from tee to green, sand bunkers, flags, and trees between holes. */
export function paintGolfCourse(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const holes: { tee: Vector2; green: Vector2 }[] = [];
  for (let i = 0; i < 60 && holes.length < 4; i += 1) {
    const tee = { x: deterministicUnit(i, 881) * layout.width, y: deterministicUnit(i, 883) * layout.height };
    const turn = deterministicUnit(i, 885) * Math.PI * 2;
    const length = unit * (0.14 + deterministicUnit(i, 887) * 0.08);
    const green = { x: tee.x + Math.cos(turn) * length, y: tee.y + Math.sin(turn) * length };
    let clear = true;
    for (let t = 0; t <= 1 && clear; t += 0.2) {
      const p = lerp(tee, green, t);
      clear = freeAt(layout, p, unit * 0.05) && !avoid(p, unit * 0.04) && !holes.some((h) => [h.tee, h.green, lerp(h.tee, h.green, 0.5)].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < unit * 0.07));
    }
    if (clear) holes.push({ tee, green });
  }
  const crowns: { x: number; y: number; r: number }[] = [];
  holes.forEach(({ tee, green }, i) => {
    const angle = Math.atan2(green.y - tee.y, green.x - tee.x);
    const length = Math.hypot(green.x - tee.x, green.y - tee.y);
    // A rough fringe, then the mown fairway with its stripes, the tee box and the green.
    fill(graphics, box(lerp(tee, green, 0.5), length + unit * 0.03, unit * 0.05, angle), 0x8fae6c, 0.9);
    fill(graphics, raggedOutline(box(lerp(tee, green, 0.5), length, unit * 0.035, angle), unit * 0.4), 0xa5c47e);
    graphics.lineStyle(unit * 0.006, 0xb2cf8a, 0.5);
    for (let t = 0.1; t < 0.9; t += 0.16) {
      const [a, b] = [lerp(tee, green, t), lerp(tee, green, t + 0.07)];
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    fill(graphics, box(tee, unit * 0.014, unit * 0.01, angle), 0xb8d48e);
    graphics.fillStyle(0xbcdc94, 1);
    graphics.fillCircle(green.x, green.y, unit * 0.022);
    // Bunkers by the green.
    for (const s of [-1, 1]) {
      const at = { x: green.x - Math.sin(angle) * s * unit * 0.026 - Math.cos(angle) * unit * 0.008, y: green.y + Math.cos(angle) * s * unit * 0.026 - Math.sin(angle) * unit * 0.008 };
      if (deterministicUnit(i * 3 + s, 889) < 0.3) continue;
      graphics.fillStyle(0xe6d7a8, 1);
      graphics.fillEllipse(at.x, at.y, unit * 0.018, unit * 0.011);
    }
    // The flag.
    graphics.lineStyle(Math.max(1, unit * 0.0016), 0xf4f1e8, 1);
    graphics.lineBetween(green.x, green.y, green.x, green.y - unit * 0.016);
    graphics.fillStyle(0xd0463b, 1);
    graphics.fillTriangle(green.x, green.y - unit * 0.016, green.x + unit * 0.009, green.y - unit * 0.013, green.x, green.y - unit * 0.01);
    // Trees lining the hole.
    for (let k = 0; k < 6; k += 1) {
      const t = deterministicUnit(i * 9 + k, 891);
      const s = k % 2 ? 1 : -1;
      const p = lerp(tee, green, t);
      const at = { x: p.x - Math.sin(angle) * s * unit * 0.04, y: p.y + Math.cos(angle) * s * unit * 0.04 };
      if (freeAt(layout, at, unit * 0.012)) crowns.push({ x: at.x, y: at.y, r: unit * (0.008 + deterministicUnit(i * 9 + k, 893) * 0.006) });
    }
  });
  paintCanopy(graphics, crowns, palette);
  return (point, radius) => holes.some(({ tee, green }) => {
    for (let t = 0; t <= 1; t += 0.25) {
      const p = lerp(tee, green, t);
      if (Math.hypot(p.x - point.x, p.y - point.y) < unit * 0.045 + radius) return true;
    }
    return false;
  });
}

// ─── Falcon Air Base: wooded hills and a fenced base ────────────────────────────────────────

/** Rolling hills on open ground, shaded from the north-west with wooded lower slopes. Returns where they lie. */
export function paintHills(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const hills: { center: Vector2; radius: number }[] = [];
  for (let i = 0; i < 80 && hills.length < 5; i += 1) {
    const radius = unit * (0.1 + deterministicUnit(i, 901) * 0.1);
    const center = { x: deterministicUnit(i, 903) * layout.width, y: deterministicUnit(i, 905) * layout.height };
    if (!clearOfAirfield(layout, center, radius + unit * 0.08) || avoid(center, radius)) continue;
    if (hills.some((h) => Math.hypot(h.center.x - center.x, h.center.y - center.y) < (h.radius + radius) * 0.75)) continue;
    hills.push({ center, radius });
  }
  const crowns: { x: number; y: number; r: number }[] = [];
  hills.forEach(({ center, radius }, i) => {
    const outline = Array.from({ length: 14 }, (_, k) => {
      const turn = (k / 14) * Math.PI * 2;
      const reach = radius * (0.8 + deterministicUnit(i * 14 + k, 907) * 0.35);
      return { x: center.x + Math.cos(turn) * reach * 1.25, y: center.y + Math.sin(turn) * reach * 0.85 };
    });
    // The shaded south-east flank first, then rising contours, each lighter and nudged toward the light.
    fill(graphics, outline.map((p) => ({ x: p.x + radius * 0.12, y: p.y + radius * 0.14 })), 0x3f5034, 0.35);
    for (let level = 0; level < 5; level += 1) {
      const share = 1 - level * 0.18;
      const shift = { x: -level * radius * 0.05, y: -level * radius * 0.06 };
      const color = mixColor(0x5e7148, 0xb7c08d, level / 4);
      fill(graphics, outline.map((p) => ({ x: center.x + (p.x - center.x) * share + shift.x, y: center.y + (p.y - center.y) * share + shift.y })), color, 0.95);
    }
    // Woods on the lower slopes.
    for (let k = 0; k < 26; k += 1) {
      const turn = deterministicUnit(i * 40 + k, 909) * Math.PI * 2;
      const reach = radius * (0.7 + deterministicUnit(i * 40 + k, 911) * 0.35);
      const at = { x: center.x + Math.cos(turn) * reach * 1.2, y: center.y + Math.sin(turn) * reach * 0.82 };
      if (freeAt(layout, at, unit * 0.012)) crowns.push({ x: at.x, y: at.y, r: unit * (0.009 + deterministicUnit(i * 40 + k, 913) * 0.007) });
    }
  });
  paintCanopy(graphics, crowns, palette);
  return (point, radius) => hills.some((h) => Math.hypot(h.center.x - point.x, h.center.y - point.y) < h.radius * 1.3 + radius);
}

/** A security fence with a patrol road inside it around the whole airfield, with guard posts at its corners. */
export function paintPerimeter(graphics: Graphics, layout: SpecialistLayout): void {
  const unit = unitOf(layout);
  const corners: Vector2[] = [...layout.apron];
  for (const runway of layout.runways) {
    const [c, s] = [Math.cos(runway.angle), Math.sin(runway.angle)];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push({ x: runway.center.x + (a * runway.length * c) / 2 - (b * runway.width * s) / 2, y: runway.center.y + (a * runway.length * s) / 2 + (b * runway.width * c) / 2 });
  }
  for (const pad of layout.helipads) corners.push({ x: pad.center.x - pad.radius, y: pad.center.y - pad.radius }, { x: pad.center.x + pad.radius, y: pad.center.y + pad.radius });
  const hull = convexHull(corners);
  const middle = hull.reduce((sum, p) => ({ x: sum.x + p.x / hull.length, y: sum.y + p.y / hull.length }), { x: 0, y: 0 });
  const grown = (gap: number) => hull.map((p) => {
    const away = { x: p.x - middle.x, y: p.y - middle.y };
    const length = Math.hypot(away.x, away.y) || 1;
    return { x: p.x + (away.x / length) * gap, y: p.y + (away.y / length) * gap };
  });
  // The patrol road, then the fence a little outside it: a pale line of posts on a dark wire.
  graphics.lineStyle(unit * 0.012, 0xa9a68f, 0.8);
  tracePolygon(graphics, grown(unit * 0.045));
  graphics.strokePath();
  const fence = grown(unit * 0.065);
  graphics.lineStyle(Math.max(1, unit * 0.002), 0x39433a, 0.9);
  tracePolygon(graphics, fence);
  graphics.strokePath();
  graphics.fillStyle(0xd7d4c2, 1);
  fence.forEach((a, i) => {
    const b = fence[(i + 1) % fence.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < length; d += unit * 0.018) {
      const p = lerp(a, b, d / length);
      graphics.fillCircle(p.x, p.y, Math.max(1, unit * 0.0018));
    }
    // A guard post at each corner.
    fill(graphics, box(a, unit * 0.014, unit * 0.014, 0).map((p) => ({ x: p.x + unit * 0.003, y: p.y + unit * 0.004 })), 0x2d3a33, 0.3);
    fill(graphics, box(a, unit * 0.014, unit * 0.014, 0), 0x6a7560);
    fill(graphics, box(a, unit * 0.008, unit * 0.008, 0), 0x8f9a80);
  });
}

/** A radar station on a free patch near the base: a white dome and a dish that keeps turning. */
export function addRadarStation(scene: Phaser.Scene, graphics: Graphics, layout: SpecialistLayout, avoid: (point: Vector2, radius: number) => boolean, depth = -19.6): void {
  const unit = unitOf(layout);
  const terminal = layout.buildings[0].center;
  let site: Vector2 | undefined;
  for (let ring = 0.22; ring < 0.6 && !site; ring += 0.04) for (let k = 0; k < 16 && !site; k += 1) {
    const turn = (k / 16) * Math.PI * 2;
    const at = { x: terminal.x + Math.cos(turn) * unit * ring, y: terminal.y + Math.sin(turn) * unit * ring };
    if (freeAt(layout, at, unit * 0.06) && !avoid(at, unit * 0.04)) site = at;
  }
  if (!site) return;
  const dome = { x: site.x - unit * 0.025, y: site.y };
  const dish = { x: site.x + unit * 0.022, y: site.y };
  // A fenced compound with its dome.
  fill(graphics, box(site, unit * 0.09, unit * 0.05, 0), 0xa5a28e, 0.9);
  graphics.lineStyle(Math.max(1, unit * 0.002), 0x39433a, 0.8);
  tracePolygon(graphics, box(site, unit * 0.09, unit * 0.05, 0));
  graphics.strokePath();
  graphics.fillStyle(0x2d3a33, 0.3);
  graphics.fillCircle(dome.x + unit * 0.006, dome.y + unit * 0.008, unit * 0.017);
  graphics.fillStyle(0xe9ebe6, 1);
  graphics.fillCircle(dome.x, dome.y, unit * 0.017);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(dome.x - unit * 0.005, dome.y - unit * 0.006, unit * 0.007);
  fill(graphics, box(dish, unit * 0.01, unit * 0.01, 0), 0x6a7560);
  if (!scene.add?.graphics) return;
  const antenna = scene.add.graphics().setDepth(depth).setPosition(dish.x, dish.y);
  antenna.fillStyle(0x2d3a33, 0.3);
  antenna.fillRect(-unit * 0.016 + unit * 0.003, -unit * 0.003 + unit * 0.004, unit * 0.032, unit * 0.006);
  antenna.fillStyle(0xd6d9d2, 1);
  antenna.fillRect(-unit * 0.016, -unit * 0.003, unit * 0.032, unit * 0.006);
  animate(scene, antenna, (seconds) => antenna.setRotation(seconds * 1.4));
}
