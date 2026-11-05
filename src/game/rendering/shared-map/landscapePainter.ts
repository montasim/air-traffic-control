import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type { PlayableMapLayout } from "../../maps/types";
import type { MapRunway } from "../../maps/shared/airfield";
import { pointInPolygon } from "../../maps/shared/apronLayout";
import { convexHull, type MapBuilding } from "./airfieldPainter";
import { clearOfAirfield, mixColor } from "./apronPainter";
import { deterministicUnit, tracePolygon } from "./geometry";
import type { CivilMapPalette } from "./types";
import { castAlpha, castReach } from "./lighting";

/**
 * Landscape pieces first made for Saltmarsh Gateway and shared by every land map: shored ponds,
 * shaded canopies, edge forests, hedgerows and a control tower, all coloured from the map palette.
 */
type Airfield = PlayableMapLayout & { readonly runways: readonly MapRunway[] };
type TowerAirfield = Airfield & { readonly apron: readonly Vector2[]; readonly buildings: readonly MapBuilding[] };

/** A pond with a sandy shore, a pale shallow band and a deeper centre. */
export function paintShoredPool(graphics: Phaser.GameObjects.Graphics, points: readonly Vector2[], palette: CivilMapPalette): void {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const scaled = (factor: number) => points.map((point) => ({ x: center.x + (point.x - center.x) * factor, y: center.y + (point.y - center.y) * factor }));
  for (const [factor, color] of [[1.16, palette.waterEdge], [1, palette.waterShallow], [0.8, palette.water], [0.5, mixColor(palette.water, palette.shadow, 0.25)]] as const) {
    graphics.fillStyle(color, 1);
    tracePolygon(graphics, scaled(factor));
    graphics.fillPath();
  }
}

/** Overlapping crowns painted in passes (shadows, dark base, crown, highlight) so a clump reads as one canopy. */
export function paintCanopy(graphics: Phaser.GameObjects.Graphics, crowns: readonly { x: number; y: number; r: number }[], palette: CivilMapPalette): void {
  graphics.fillStyle(palette.shadow, castAlpha(0.3));
  for (const c of crowns) graphics.fillCircle(c.x + c.r * 0.6 * castReach(), c.y + c.r * 0.5 * castReach(), c.r);
  graphics.fillStyle(mixColor(palette.vegetation, palette.shadow, 0.35), 1);
  for (const c of crowns) graphics.fillCircle(c.x, c.y, c.r);
  graphics.fillStyle(palette.vegetation, 1);
  for (const c of crowns) graphics.fillCircle(c.x - c.r * 0.18, c.y - c.r * 0.18, c.r * 0.78);
  graphics.fillStyle(palette.vegetationLight, 0.9);
  for (const c of crowns) graphics.fillCircle(c.x - c.r * 0.38, c.y - c.r * 0.38, c.r * 0.36);
}

/** Forest clumps in the band along the map edges, wherever they stay clear of the airfield and of `avoid` (water). */
export function paintForests(
  graphics: Phaser.GameObjects.Graphics,
  layout: Airfield,
  palette: CivilMapPalette,
  clumps: number,
  avoid: (point: Vector2, radius: number) => boolean = () => false,
): void {
  const unit = Math.min(layout.width, layout.height);
  const band = unit * 0.16;
  const crowns: { x: number; y: number; r: number }[] = [];
  for (let i = 0, placed = 0; i < clumps * 6 && placed < clumps; i += 1) {
    // Walk the perimeter, then step inward by up to the band width.
    const around = deterministicUnit(i, 401) * 2 * (layout.width + layout.height);
    const inward = deterministicUnit(i, 409) * band;
    const edge = around < layout.width ? { x: around, y: inward }
      : around < layout.width + layout.height ? { x: layout.width - inward, y: around - layout.width }
      : around < 2 * layout.width + layout.height ? { x: around - layout.width - layout.height, y: layout.height - inward }
      : { x: inward, y: around - 2 * layout.width - layout.height };
    const radius = unit * (0.035 + deterministicUnit(i, 419) * 0.035);
    if (!clearOfAirfield(layout, edge, radius + unit * 0.04)) continue;
    if (avoid(edge, radius)) continue;
    placed += 1;
    for (let k = 0; k < 9; k += 1) {
      const angle = deterministicUnit(i * 13 + k, 431) * Math.PI * 2;
      const distance = Math.sqrt(deterministicUnit(i * 13 + k, 433)) * radius;
      crowns.push({ x: edge.x + Math.cos(angle) * distance, y: edge.y + Math.sin(angle) * distance, r: unit * (0.012 + deterministicUnit(i * 13 + k, 439) * 0.01) });
    }
  }
  paintCanopy(graphics, crowns, palette);
}

/** Loose hedgerows along some field edges: uneven bushes with gaps, nudged off the line, off the airfield. */
export function paintHedgerows(
  graphics: Phaser.GameObjects.Graphics,
  layout: Airfield,
  fieldPolygons: readonly (readonly Vector2[])[],
  palette: CivilMapPalette,
  avoid: (point: Vector2, radius: number) => boolean = () => false,
): void {
  const unit = Math.min(layout.width, layout.height);
  const bushes: { x: number; y: number; r: number }[] = [];
  fieldPolygons.forEach((field, f) => {
    field.forEach((a, i) => {
      if ((i + f) % 3) return;
      const b = field[(i + 1) % field.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const step = unit * 0.016;
      const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
      for (let s = step, k = 0; s < length - step; s += step, k += 1) {
        const seed = f * 97 + i * 31 + k;
        // Gaps of a few bushes break the line up.
        if (deterministicUnit(Math.floor(k / 3) + seed * 7, 461) < 0.4) continue;
        const nudge = (deterministicUnit(seed, 463) - 0.5) * unit * 0.008;
        const point = { x: a.x + ((b.x - a.x) * s) / length + normal.x * nudge, y: a.y + ((b.y - a.y) * s) / length + normal.y * nudge };
        if (point.x < 0 || point.y < 0 || point.x > layout.width || point.y > layout.height) continue;
        const r = unit * (0.005 + deterministicUnit(seed, 457) * 0.006);
        if (clearOfAirfield(layout, point, r + unit * 0.03) && !avoid(point, r)) bushes.push({ ...point, r });
      }
    });
  });
  paintCanopy(graphics, bushes, palette);
}

/** A loose field patchwork covering the map: a grid of `cell`-sized quads with jittered corners, so no two fields line up exactly. */
export function fieldPatchwork(width: number, height: number, cell: number): Vector2[][] {
  const jitter = (i: number, j: number, salt: number) => (deterministicUnit(i * 31 + j, salt) - 0.5) * cell * 0.3;
  const corner = (i: number, j: number) => ({ x: i * cell + jitter(i, j, 601), y: j * cell + jitter(i, j, 607) });
  const fields: Vector2[][] = [];
  for (let i = -1; i * cell < width + cell; i += 1) {
    for (let j = -1; j * cell < height + cell; j += 1) fields.push([corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]);
  }
  return fields;
}

/** Breaks a smooth outline into a ragged one: each edge cut into short steps nudged in and out. */
export function raggedOutline(outline: readonly Vector2[], unit: number): Vector2[] {
  const step = unit * 0.025;
  return outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const count = Math.max(1, Math.round(length / step));
    return Array.from({ length: count }, (_, k) => {
      const t = k / count;
      const nudge = k === 0 ? 0 : (deterministicUnit(i * 97 + k, 831) - 0.5) * unit * 0.024;
      return { x: a.x + (b.x - a.x) * t + normal.x * nudge, y: a.y + (b.y - a.y) * t + normal.y * nudge };
    });
  });
}

/**
 * Open sea along a ragged shore, first made for Frost Crossing: a pale shelf over the land, deep
 * water, a lighter band just off the shore, and broken floes drifting thickest near it.
 */
export function paintBrokenShore(
  graphics: Phaser.GameObjects.Graphics,
  bounds: { readonly width: number; readonly height: number },
  waters: readonly (readonly Vector2[])[],
  palette: CivilMapPalette,
  floes: number,
): void {
  const unit = Math.min(bounds.width, bounds.height);
  waters.forEach((water, w) => {
    const shore = raggedOutline(water, unit);
    const closed = [...shore, shore[0]];
    const strokeShore = (width: number, color: number, alpha: number) => {
      graphics.lineStyle(width, color, alpha);
      tracePolygon(graphics, shore);
      graphics.strokePath();
    };
    strokeShore(unit * 0.07, palette.waterEdge, 0.7);
    graphics.fillStyle(palette.water, 1);
    tracePolygon(graphics, shore);
    graphics.fillPath();
    strokeShore(unit * 0.05, palette.waterShallow, 0.85);
    strokeShore(unit * 0.012, palette.terrainLight, 0.9);
    const xs = water.map((p) => p.x), ys = water.map((p) => p.y);
    const [left, right] = [Math.max(0, Math.min(...xs)), Math.min(bounds.width, Math.max(...xs))];
    const [top, bottom] = [Math.max(0, Math.min(...ys)), Math.min(bounds.height, Math.max(...ys))];
    for (let i = 0; i < floes; i += 1) {
      const seed = w * 1000 + i;
      const point = { x: left + deterministicUnit(seed, 841) * (right - left), y: top + deterministicUnit(seed, 853) * (bottom - top) };
      if (!pointInPolygon(point, shore)) continue;
      // Floes crowd the shore and thin out toward open water.
      const nearShore = nearRiver(closed, 0, point, unit * 0.14);
      if (!nearShore && deterministicUnit(seed, 857) > 0.15) continue;
      const size = unit * (nearShore ? 0.01 + deterministicUnit(seed, 859) * 0.022 : 0.006 + deterministicUnit(seed, 859) * 0.01);
      const floe = Array.from({ length: 6 }, (_, k) => {
        const turn = (k / 6) * Math.PI * 2 + deterministicUnit(seed, 863);
        const reach = size * (0.6 + deterministicUnit(seed * 6 + k, 867) * 0.6);
        return { x: point.x + Math.cos(turn) * reach, y: point.y + Math.sin(turn) * reach * 0.8 };
      });
      graphics.fillStyle(palette.waterShallow, 0.9);
      tracePolygon(graphics, floe.map((p) => ({ x: p.x + size * 0.2, y: p.y + size * 0.25 })));
      graphics.fillPath();
      graphics.fillStyle(0xf2fbfe, 0.95);
      tracePolygon(graphics, floe);
      graphics.fillPath();
    }
  });
}

/**
 * Surf-washed rocks along a shore, seen from above: dark boulders lit on top, each ringed by white
 * foam, scattered just off the outline (outside it) and thickest close in.
 */
export function paintShoreRocks(graphics: Phaser.GameObjects.Graphics, outline: readonly Vector2[], unit: number, count: number, seed: number): void {
  const perimeter = outline.map((point, i) => Math.hypot(outline[(i + 1) % outline.length].x - point.x, outline[(i + 1) % outline.length].y - point.y));
  const total = perimeter.reduce((sum, length) => sum + length, 0);
  const middle = outline.reduce((sum, point) => ({ x: sum.x + point.x / outline.length, y: sum.y + point.y / outline.length }), { x: 0, y: 0 });
  for (let n = 0; n < count; n += 1) {
    // Walk the outline to a random point on it, then step outward off the beach.
    let left = deterministicUnit(n, seed) * total;
    let i = 0;
    while (left > perimeter[i]) left -= perimeter[i++];
    const [a, b] = [outline[i], outline[(i + 1) % outline.length]];
    const t = perimeter[i] ? left / perimeter[i] : 0;
    const onShore = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const outward = { x: onShore.x - middle.x, y: onShore.y - middle.y };
    const reach = Math.hypot(outward.x, outward.y) || 1;
    const offset = unit * (0.008 + deterministicUnit(n, seed + 1) ** 2 * 0.045);
    const center = { x: onShore.x + (outward.x / reach) * offset, y: onShore.y + (outward.y / reach) * offset };
    const size = unit * (0.004 + deterministicUnit(n, seed + 2) * 0.008);
    const rock = Array.from({ length: 6 }, (_, k) => {
      const turn = (k / 6) * Math.PI * 2 + deterministicUnit(n, seed + 3);
      const r = size * (0.7 + deterministicUnit(n * 6 + k, seed + 4) * 0.5);
      return { x: center.x + Math.cos(turn) * r, y: center.y + Math.sin(turn) * r * 0.8 };
    });
    const grown = (share: number) => rock.map((point) => ({ x: center.x + (point.x - center.x) * share, y: center.y + (point.y - center.y) * share }));
    for (const [points, color, alpha] of [
      [grown(1.9), 0xf2f9fa, 0.35],
      [grown(1.35), 0xf2f9fa, 0.55],
      [rock, 0x55534b, 1],
      [grown(0.65).map((point) => ({ x: point.x - size * 0.18, y: point.y - size * 0.22 })), 0x86827a, 1],
    ] as const) {
      graphics.fillStyle(color, alpha);
      tracePolygon(graphics, points);
      graphics.fillPath();
    }
  }
}

/** Whether a circle comes within the banks of a river of the given width along `river`. */
export function nearRiver(river: readonly Vector2[], width: number, point: Vector2, radius: number): boolean {
  return river.some((a, i) => {
    if (i === 0) return false;
    const b = river[i - 1];
    const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length));
    return Math.hypot(point.x - (a.x + (b.x - a.x) * t), point.y - (a.y + (b.y - a.y) * t)) < width * 0.67 + radius;
  });
}

/**
 * A control tower beside the apron tip nearest the terminal, with two fuel tanks: a square
 * shaft with shaded walls, an octagonal glazed cab on top, and one shadow cast from both.
 */
export function paintControlTower(graphics: Phaser.GameObjects.Graphics, layout: TowerAirfield, palette: CivilMapPalette): void {
  const unit = Math.min(layout.width, layout.height);
  const terminal = layout.buildings.find((building) => building.kind === 'terminal');
  if (!terminal || !layout.apron.length) return;
  const axis = { x: Math.cos(layout.runways[0].angle), y: Math.sin(layout.runways[0].angle) };
  const middle = layout.apron.reduce((sum, point) => ({ x: sum.x + point.x / layout.apron.length, y: sum.y + point.y / layout.apron.length }), { x: 0, y: 0 });
  const side = Math.sign((terminal.center.x - middle.x) * axis.x + (terminal.center.y - middle.y) * axis.y) || 1;
  const tip = layout.apron.reduce((best, point) =>
    ((point.x - middle.x) * axis.x + (point.y - middle.y) * axis.y) * side > ((best.x - middle.x) * axis.x + (best.y - middle.y) * axis.y) * side ? point : best);
  const base = { x: tip.x + axis.x * side * unit * 0.045, y: tip.y + axis.y * side * unit * 0.045 };
  const height = unit * 0.05;
  if (!clearOfAirfield(layout, base, unit * 0.02) || base.x < 0 || base.y < 0 || base.x > layout.width || base.y > layout.height) return;
  // Drawn like the raised buildings: lifted straight up, walls shaded by facing, and the
  // shadow cast from the whole tower to the south-east at the buildings' angle and strength.
  const lift = { x: 0, y: -height * 0.5 };
  const cab = { x: base.x + lift.x, y: base.y + lift.y };
  const cast = { x: height * 0.86 * castReach(), y: height * 0.68 * castReach() };
  const angle = layout.runways[0].angle;
  const polygon = (center: Vector2, radius: number, sides: number) =>
    Array.from({ length: sides }, (_, i) => {
      const turn = angle + Math.PI / sides + (i * Math.PI * 2) / sides;
      return { x: center.x + Math.cos(turn) * radius, y: center.y + Math.sin(turn) * radius };
    });
  // Reversed to the same winding as rotatedRectangle, so walls shade like the terminal's.
  const footprint = polygon(base, unit * 0.011, 4).reverse();
  const top = footprint.map((point) => ({ x: point.x + lift.x, y: point.y + lift.y }));
  const cabRadius = unit * 0.017;
  graphics.fillStyle(palette.shadow, castAlpha(0.3));
  tracePolygon(graphics, convexHull([
    ...footprint,
    ...polygon({ x: cab.x - lift.x + cast.x, y: cab.y - lift.y + cast.y }, cabRadius, 8)
  ]));
  graphics.fillPath();
  for (let i = 0; i < footprint.length; i += 1) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const away = Math.max(0, ((b.y - a.y) / length) * 0.6 - ((b.x - a.x) / length) * 0.8);
    graphics.fillStyle(mixColor(palette.building, palette.shadow, 0.25 + away * 0.35), 1);
    tracePolygon(graphics, [a, b, top[(i + 1) % top.length], top[i]]);
    graphics.fillPath();
  }
  // Octagonal cab: dark frame, a glazed band, and a light roof with an antenna.
  graphics.fillStyle(0x3f6f78, 1);
  tracePolygon(graphics, polygon(cab, cabRadius, 8));
  graphics.fillPath();
  graphics.fillStyle(0x9fd3dc, 0.9);
  tracePolygon(graphics, polygon(cab, cabRadius * 0.8, 8));
  graphics.fillPath();
  graphics.fillStyle(mixColor(palette.building, palette.buildingRoof, 0.5), 1);
  tracePolygon(graphics, polygon(cab, cabRadius * 0.58, 8));
  graphics.fillPath();
  graphics.lineStyle(Math.max(1, unit * 0.0016), palette.buildingRoof, 0.85);
  graphics.strokeCircle(cab.x, cab.y, unit * 0.0035);
  // Two fuel tanks set back from the tower.
  const across = { x: -axis.y, y: axis.x };
  for (const offset of [-1, 1]) {
    // Far enough out that neither tank touches the raised cab.
    const tank = { x: base.x + across.x * offset * unit * 0.028 + axis.x * side * unit * 0.036, y: base.y + across.y * offset * unit * 0.028 + axis.y * side * unit * 0.036 };
    if (!clearOfAirfield(layout, tank, unit * 0.012)) continue;
    graphics.fillStyle(palette.shadow, castAlpha(0.28));
    graphics.fillCircle(tank.x + unit * 0.006 * castReach(), tank.y + unit * 0.005 * castReach(), unit * 0.011);
    graphics.fillStyle(0xd9dcd4, 1);
    graphics.fillCircle(tank.x, tank.y, unit * 0.011);
    graphics.lineStyle(Math.max(1, unit * 0.0015), 0x8b918d, 1);
    graphics.strokeCircle(tank.x, tank.y, unit * 0.007);
  }
}
