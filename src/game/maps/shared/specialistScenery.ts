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
import { animateDrawing } from '../../rendering/shared-map/motion';
import { castAlpha, castReach } from '../../rendering/shared-map/lighting';

/**
 * The signature landscape of each specialist field, so no two of them look alike: an open-pit
 * quarry and a wind farm, a solar farm and an orchard, a coastal headland with a marina and
 * golf course, and wooded hills around a fenced military base. Everything keeps clear of the
 * runways, aprons and pads.
 */

type Graphics = Phaser.GameObjects.Graphics;
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
/** Whether a circle stays clear of the airfield and inside the map. */
const freeAt = (layout: SpecialistLayout, point: Vector2, radius: number) =>
  point.x > radius * 0.3 && point.y > radius * 0.3 && point.x < layout.width - radius * 0.3 && point.y < layout.height - radius * 0.3 && clearOfAirfield(layout, point, radius);


// ─── Freight Junction: a quarry and a wind farm ─────────────────────────────────────────────

/** Whether a point lies under one of the on-screen panels, with a margin. */
const underPanel = (layout: SpecialistLayout, point: Vector2, margin: number) =>
  layout.hudExclusionZones.some((zone) => point.x > zone.x - margin && point.x < zone.x + zone.width + margin && point.y > zone.y - margin && point.y < zone.y + zone.height + margin);

/** Open spots for a feature of `radius`, farthest from the terminal first. */
function openSites(layout: SpecialistLayout, radius: number, avoid: (point: Vector2, radius: number) => boolean): Vector2[] {
  const unit = unitOf(layout);
  const terminal = layout.buildings[0].center;
  const sites: Vector2[] = [];
  for (let x = radius; x < layout.width - radius * 0.5; x += unit * 0.04) for (let y = radius; y < layout.height - radius * 0.5; y += unit * 0.04) {
    const at = { x, y };
    if (freeAt(layout, at, radius + unit * 0.04) && !avoid(at, radius) && !underPanel(layout, at, radius * 0.5)) sites.push(at);
  }
  return sites.sort((a, b) => Math.hypot(b.x - terminal.x, b.y - terminal.y) - Math.hypot(a.x - terminal.x, a.y - terminal.y));
}

/**
 * An open-pit quarry: stepped terraces descending to a pooled floor, a haul road spiralling down,
 * stockpiles of crushed stone by the rim, and the crusher shed. Returns where it lies.
 */
export function paintQuarry(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const radius = unit * 0.15;
  const center = openSites(layout, radius * 1.3, avoid)[0];
  if (!center) return () => false;
  const outline = Array.from({ length: 14 }, (_, k) => {
    const turn = (k / 14) * Math.PI * 2;
    const reach = radius * (0.85 + deterministicUnit(k, 921) * 0.25);
    return { x: center.x + Math.cos(turn) * reach * 1.3, y: center.y + Math.sin(turn) * reach };
  });
  const level = (share: number, shift = 0) => outline.map((p) => ({ x: center.x + (p.x - center.x) * share + shift, y: center.y + (p.y - center.y) * share + shift * 1.2 }));
  // Spoil and dust around the rim, then each terrace a little deeper and darker, its drop in shade.
  fill(graphics, level(1.12), 0xcdbf9c, 0.85);
  for (let step = 0; step < 6; step += 1) {
    const share = 1 - step * 0.15;
    const tone = mixColor(0xc9b892, 0x7f7058, step / 5);
    fill(graphics, level(share), mixColor(tone, 0x3b3226, 0.45));
    fill(graphics, level(share * 0.97, radius * 0.025), tone);
  }
  // A green pool lying on the quarry floor.
  graphics.fillStyle(0x5e8f86, 1);
  graphics.fillEllipse(center.x + radius * 0.08, center.y + radius * 0.1, radius * 0.38, radius * 0.22);
  // The haul road, spiralling from the rim down to the floor.
  const ramp: Vector2[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const turn = -0.6 + t * Math.PI * 2.4;
    const reach = radius * (1.02 - t * 0.78);
    ramp.push({ x: center.x + Math.cos(turn) * reach * 1.25, y: center.y + Math.sin(turn) * reach * 0.95 });
  }
  graphics.lineStyle(Math.max(1.5, unit * 0.005), 0xe0d3b2, 0.9);
  strokePolyline(graphics, ramp);
  // Stockpiles of crushed stone by the rim: cones lit on their north-west side.
  for (let k = 0; k < 4; k += 1) {
    const turn = 0.6 + k * 0.45;
    const at = { x: center.x + Math.cos(turn) * radius * 1.55, y: center.y + Math.sin(turn) * radius * 1.2 };
    if (!freeAt(layout, at, unit * 0.025)) continue;
    const r = unit * (0.014 + deterministicUnit(k, 923) * 0.008);
    graphics.fillStyle(0x3b3226, 0.3);
    graphics.fillCircle(at.x + r * 0.5, at.y + r * 0.6, r);
    graphics.fillStyle(0x9a8e78, 1);
    graphics.fillCircle(at.x, at.y, r);
    graphics.fillStyle(0xc4b99f, 1);
    graphics.fillCircle(at.x - r * 0.3, at.y - r * 0.35, r * 0.55);
  }
  // The crusher shed at the top of the haul road.
  const shed = { x: ramp[0].x + unit * 0.035, y: ramp[0].y + unit * 0.01 };
  if (freeAt(layout, shed, unit * 0.03)) {
    paintRaisedBuilding(graphics, { id: 'quarry-crusher', center: shed, width: unit * 0.045, height: unit * 0.028, angle: 0.3, kind: 'hangar' }, { ...palette, building: 0x9a978a, buildingRoof: 0xc9c5b6 }, unit);
  }
  return (point, r) => Math.hypot(point.x - center.x, point.y - center.y) < radius * 1.75 + r;
}

/** Turbines turning on a hilltop row, each with its pad, tower shadow and nacelle; the blades are animated. */
export function addWindFarm(scene: Phaser.Scene, graphics: Graphics, layout: SpecialistLayout, avoid: (point: Vector2, radius: number) => boolean, depth = -19.6): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const turbines: Vector2[] = [];
  for (const at of openSites(layout, unit * 0.045, avoid)) {
    if (turbines.length >= 6) break;
    if (turbines.every((other) => Math.hypot(other.x - at.x, other.y - at.y) > unit * 0.1)
      && (turbines.length === 0 || turbines.some((other) => Math.hypot(other.x - at.x, other.y - at.y) < unit * 0.2))) turbines.push(at);
  }
  if (!turbines.length) return () => false;
  const blade = unit * 0.04;
  // The rotors face into a south-westerly wind.
  const facing = Math.PI * 0.75;
  for (const at of turbines) {
    graphics.fillStyle(0xb3ad98, 1);
    graphics.fillCircle(at.x, at.y, unit * 0.008);
    // The tall tower casts a long shadow, and so do the turning blades, as a faint disc.
    graphics.lineStyle(Math.max(1.5, unit * 0.004), 0x2d3a33, castAlpha(0.3));
    graphics.lineBetween(at.x, at.y, at.x + unit * 0.06 * castReach(), at.y + unit * 0.075 * castReach());
    graphics.fillStyle(0x2d3a33, castAlpha(0.08));
    graphics.fillCircle(at.x + unit * 0.06 * castReach(), at.y + unit * 0.075 * castReach(), blade);
  }
  if (!scene.add?.graphics) return () => false;
  const rotors = scene.add.graphics().setDepth(depth);
  animateDrawing(scene, rotors, (seconds) => {
    rotors.clear();
    turbines.forEach((at, i) => {
      const nacelle = box(at, unit * 0.016, unit * 0.006, facing);
      fill(rotors, nacelle, 0xe9ebe6);
      const hub = { x: at.x + Math.cos(facing) * unit * 0.009, y: at.y + Math.sin(facing) * unit * 0.009 };
      for (let k = 0; k < 3; k += 1) {
        const turn = seconds * 1.6 + i * 1.3 + (k * Math.PI * 2) / 3;
        const tip = { x: hub.x + Math.cos(turn) * blade, y: hub.y + Math.sin(turn) * blade };
        const side = { x: -Math.sin(turn) * unit * 0.0035, y: Math.cos(turn) * unit * 0.0035 };
        rotors.fillStyle(0xf4f5f2, 1);
        rotors.fillTriangle(hub.x + side.x, hub.y + side.y, hub.x - side.x, hub.y - side.y, tip.x, tip.y);
        rotors.lineStyle(1, 0x9ea39b, 0.8);
        rotors.lineBetween(hub.x, hub.y, tip.x, tip.y);
      }
      rotors.fillStyle(0xcfd3cd, 1);
      rotors.fillCircle(hub.x, hub.y, unit * 0.004);
    });
  }, 4);
  return (point, r) => turbines.some((at) => Math.hypot(at.x - point.x, at.y - point.y) < blade * 1.2 + r);
}

// ─── Metro International: a solar farm and an orchard ──────────────────────────────────────

/**
 * A solar farm on the largest open ground: rows of dark panels catching the light, a gravel track
 * through the middle, and inverter sheds. Returns where it lies.
 */
export function paintSolarFarm(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const [length, depth] = [unit * 0.34, unit * 0.22];
  const center = openSites(layout, length * 0.6, avoid)[0];
  if (!center) return () => false;
  const angle = 0.08;
  const [c, s2] = [Math.cos(angle), Math.sin(angle)];
  const at = (along: number, across: number) => ({ x: center.x + c * along - s2 * across, y: center.y + s2 * along + c * across });
  // Mown grass under the arrays, then the gravel track along the middle.
  fill(graphics, box(center, length + unit * 0.03, depth + unit * 0.03, angle), 0x9fae84, 0.9);
  fill(graphics, box(center, length, unit * 0.012, angle), 0xc9c3a8);
  // Rows of panels in two blocks either side of the track, each row a dark strip with a lit top edge.
  for (const side of [-1, 1]) for (let row = 0; row < 6; row += 1) {
    const across = side * (unit * 0.02 + row * unit * 0.016);
    for (let k = 0; k < 4; k += 1) {
      const along = -length / 2 + unit * 0.012 + k * (length - unit * 0.024) / 4 + (length - unit * 0.024) / 8;
      const panel = box(at(along, across), (length - unit * 0.024) / 4 - unit * 0.008, unit * 0.009, angle);
      fill(graphics, panel.map((p) => ({ x: p.x + unit * 0.0015, y: p.y + unit * 0.002 })), 0x2d3a33, 0.3);
      fill(graphics, panel, 0x2c4b6e);
      fill(graphics, box(at(along, across - unit * 0.0028), (length - unit * 0.024) / 4 - unit * 0.008, unit * 0.0022, angle), 0x7ea2c4, 0.85);
    }
  }
  // Inverter sheds at one end of the track.
  for (const side of [-1, 1]) {
    const shed = at(length / 2 - unit * 0.02, side * unit * 0.012);
    paintRaisedBuilding(graphics, { id: `solar-${side}`, center: shed, width: unit * 0.016, height: unit * 0.011, angle, kind: 'operations' }, { ...palette, building: 0xb9b6a8, buildingRoof: 0xdedbd0 }, unit * 0.7);
  }
  return (point, r) => Math.abs((point.x - center.x) * c + (point.y - center.y) * s2) < length / 2 + unit * 0.03 + r
    && Math.abs(-(point.x - center.x) * s2 + (point.y - center.y) * c) < depth / 2 + unit * 0.03 + r;
}

/** An orchard: fruit trees standing in tidy rows on mown grass, on open ground of its own. Returns where it lies. */
export function paintOrchard(graphics: Graphics, layout: SpecialistLayout, palette: CivilMapPalette, avoid: (point: Vector2, radius: number) => boolean): (point: Vector2, radius: number) => boolean {
  const unit = unitOf(layout);
  const [length, depth] = [unit * 0.24, unit * 0.16];
  const center = openSites(layout, length * 0.6, avoid)[0];
  if (!center) return () => false;
  const angle = -0.12;
  const [c, s2] = [Math.cos(angle), Math.sin(angle)];
  fill(graphics, raggedOutline(box(center, length, depth, angle), unit * 0.3), 0x9db479, 0.9);
  const crowns: { x: number; y: number; r: number }[] = [];
  const spacing = unit * 0.02;
  for (let along = -length / 2 + spacing; along < length / 2 - spacing * 0.5; along += spacing) {
    for (let across = -depth / 2 + spacing; across < depth / 2 - spacing * 0.5; across += spacing) {
      const seed = Math.round((along + length) / spacing) * 37 + Math.round((across + depth) / spacing);
      if (deterministicUnit(seed, 931) < 0.06) continue;
      crowns.push({ x: center.x + c * along - s2 * across, y: center.y + s2 * along + c * across, r: unit * (0.0065 + deterministicUnit(seed, 933) * 0.0015) });
    }
  }
  paintCanopy(graphics, crowns, { ...palette, vegetation: 0x5f8a45, vegetationLight: 0x9dc070 });
  return (point, r) => Math.abs((point.x - center.x) * c + (point.y - center.y) * s2) < length / 2 + unit * 0.02 + r
    && Math.abs(-(point.x - center.x) * s2 + (point.y - center.y) * c) < depth / 2 + unit * 0.02 + r;
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
  graphics.fillStyle(0x2d3a33, castAlpha(0.3));
  graphics.fillEllipse(light.x + unit * 0.02 * castReach(), light.y + unit * 0.016 * castReach(), unit * (0.022 + 0.018 * castReach()), unit * 0.014);
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
  graphics.fillStyle(0x2d3a33, castAlpha(0.3));
  graphics.fillCircle(dome.x + unit * 0.006 * castReach(), dome.y + unit * 0.008 * castReach(), unit * 0.017);
  graphics.fillStyle(0xe9ebe6, 1);
  graphics.fillCircle(dome.x, dome.y, unit * 0.017);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(dome.x - unit * 0.005, dome.y - unit * 0.006, unit * 0.007);
  fill(graphics, box(dish, unit * 0.01, unit * 0.01, 0), 0x6a7560);
  if (!scene.add?.graphics) return;
  const antenna = scene.add.graphics().setDepth(depth).setPosition(dish.x, dish.y);
  antenna.fillStyle(0x2d3a33, castAlpha(0.3));
  antenna.fillRect(-unit * 0.016 + unit * 0.003 * castReach(), -unit * 0.003 + unit * 0.004 * castReach(), unit * 0.032, unit * 0.006);
  antenna.fillStyle(0xd6d9d2, 1);
  antenna.fillRect(-unit * 0.016, -unit * 0.003, unit * 0.032, unit * 0.006);
  animateDrawing(scene, antenna, (seconds) => antenna.setRotation(seconds * 1.4), 4);
}
