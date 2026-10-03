import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type { MapRunway, MapTaxiway } from "../../maps/shared/airfield";
import type { ApronMarkings, ApronStand, GroundRoute, PlayableMapLayout } from "../../maps/types";
import { apronPolygons, onApron, runwayApronGap } from "../../maps/shared/apronLayout";
import { apronClearOfRunways } from "../../maps/shared/siteCleanup";
import { AIRCRAFT_COLORS } from "../../palette";
import type { WorldDetailLevel } from "../../palette";
import { filletCorners, strokePolyline, tracePolygon } from "./geometry";
import type { CivilMapPalette } from "./types";

/** Taxiway asphalt matches the runways, so the movement area reads as one surface. */
export const PAVING = {
  rim: 0x294b46,
  runway: 0x395b55,
} as const;

/** Blend two 0xRRGGBB colours; `amount` 0 keeps `from`, 1 gives `to`. */
export function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

function desaturate(color: number, amount: number): number {
  const [r, g, b] = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  const grey = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
  return mixColor(color, (grey << 16) | (grey << 8) | grey, amount);
}

/**
 * Parking areas are pale, low-contrast concrete taken from the map's own ground,
 * like a disabled control: present, but never competing with the runways or traffic.
 */
export function apronTones(palette: CivilMapPalette): { readonly fill: number; readonly edge: number; readonly joint: number } {
  const fill = desaturate(mixColor(palette.terrain, palette.apron, 0.4), 0.6);
  return { fill, edge: mixColor(fill, palette.shadow, 0.22), joint: mixColor(fill, palette.shadow, 0.1) };
}

const unitVector = (angle: number): Vector2 => ({ x: Math.cos(angle), y: Math.sin(angle) });
const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vector2, k: number): Vector2 => ({ x: a.x * k, y: a.y * k });

function standCorners(stand: ApronStand, grow = 0): Vector2[] {
  const along = unitVector(stand.angle);
  const across = { x: -along.y, y: along.x };
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) =>
    add(stand.position, add(scale(along, (a * (stand.length + grow)) / 2), scale(across, (c * (stand.width + grow)) / 2))));
}

/** Where a straight line at `offset` along `normal` crosses the polygon, as paired segments inside it. */
function chordsAcross(polygon: readonly Vector2[], direction: Vector2, normal: Vector2, offset: number): [Vector2, Vector2][] {
  const hits: number[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const da = a.x * normal.x + a.y * normal.y - offset;
    const db = b.x * normal.x + b.y * normal.y - offset;
    if ((da < 0) === (db < 0)) continue;
    const t = da / (da - db);
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    hits.push(p.x * direction.x + p.y * direction.y);
  }
  hits.sort((x, y) => x - y);
  const chords: [Vector2, Vector2][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) {
    chords.push([add(scale(normal, offset), scale(direction, hits[i])), add(scale(normal, offset), scale(direction, hits[i + 1]))]);
  }
  return chords;
}

/** Convex hull (monotone chain), used to merge an apron with the stand pads that overhang it. */
function convexHull(points: readonly Vector2[]): Vector2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vector2, a: Vector2, b: Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (input: Vector2[]) => {
    const hull: Vector2[] = [];
    for (const p of input) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/**
 * Each apron grown to take in the stand rows and taxilanes laid out on it, as one
 * smooth paved shape, still clear of the grass strip beside every runway.
 */
export function pavedApronShapes(
  aprons: readonly (readonly Vector2[])[],
  markings: ApronMarkings | undefined,
  clear?: { readonly runways: readonly MapRunway[]; readonly unit: number },
): Vector2[][] {
  const shapes = aprons.map((apron) => {
    const extra: Vector2[] = [];
    for (const stand of markings?.stands ?? []) {
      const lane = markings!.taxilanes.find((item) => item.id === stand.laneId);
      if (!lane || lane.path.length < 2 || !onApron(stand.position, [apron], stand.width * 1.6)) continue;
      extra.push(...standCorners(stand, stand.width * 0.35));
      for (const point of lane.path.slice(1)) extra.push(...[0, 1, 2, 3].map((i) => add(point, scale(unitVector((i * Math.PI) / 2), stand.width * 0.3))));
    }
    return extra.length ? convexHull([...apron, ...extra]) : [...apron];
  });
  return clear ? shapes.map((shape) => apronClearOfRunways(shape, clear.runways, runwayApronGap(clear.unit))) : shapes;
}

/**
 * Aprons in runway paving: a dark rim, an apron-tone surface, faint concrete
 * joints aligned to the main runway, and a thin light edge. Each apron grows to
 * take in the stand rows laid out on it, so the parking area reads as one surface.
 */
export function paintApronArea(
  graphics: Phaser.GameObjects.Graphics,
  aprons: readonly (readonly Vector2[])[],
  markings: ApronMarkings | undefined,
  palette: CivilMapPalette,
  options: { readonly unit: number; readonly detailLevel: WorldDetailLevel; readonly jointAngle?: number; readonly runways?: readonly MapRunway[] },
): void {
  const shapes = pavedApronShapes(aprons, markings, options.runways && { runways: options.runways, unit: options.unit });
  const tones = apronTones(palette);
  graphics.fillStyle(tones.fill, 1);
  for (const shape of shapes) {
    tracePolygon(graphics, shape);
    graphics.fillPath();
  }
  if (options.detailLevel !== "mobile") {
    // Concrete joints: faint lines on a grid aligned to the main runway, clipped to each apron.
    const angle = options.jointAngle ?? 0;
    const spacing = Math.max(14, options.unit * 0.035);
    graphics.lineStyle(1, tones.joint, 0.6);
    for (const [direction, normal] of [[unitVector(angle), unitVector(angle + Math.PI / 2)], [unitVector(angle + Math.PI / 2), unitVector(angle)]]) {
      for (const shape of shapes) {
        const offsets = shape.map((p) => p.x * normal.x + p.y * normal.y);
        for (let offset = Math.ceil(Math.min(...offsets) / spacing) * spacing; offset < Math.max(...offsets); offset += spacing) {
          for (const [a, b] of chordsAcross(shape, direction, normal, offset)) graphics.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
  }
  graphics.lineStyle(1.2, tones.edge, 0.7);
  for (const shape of shapes) {
    tracePolygon(graphics, shape);
    graphics.strokePath();
  }
}

const sub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;
const normalize = (a: Vector2): Vector2 => scale(a, 1 / (Math.hypot(a.x, a.y) || 1));

function quadratic(from: Vector2, control: Vector2, to: Vector2, steps = 6): Vector2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const [a, b, c] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t];
    return { x: a * from.x + b * control.x + c * to.x, y: a * from.y + b * control.y + c * to.y };
  });
}

/**
 * A widened mouth where a taxiway meets a runway or apron edge: both taxiway edges
 * curve out to meet the edge line, as real fillets do. `direction` points away from the edge.
 */
function fillet(at: Vector2, direction: Vector2, edge: Vector2, width: number, flare: number): Vector2[] {
  const side = { x: -direction.y, y: direction.x };
  const curve = (sign: number) => {
    const out = scale(edge, (Math.sign(dot(edge, side)) || 1) * sign);
    return quadratic(
      add(at, scale(out, width / 2 + flare)),
      add(at, scale(side, (sign * width) / 2)),
      add(add(at, scale(direction, flare * 1.3)), scale(side, (sign * width) / 2)),
    );
  };
  return [...curve(1), ...curve(-1).reverse()];
}

/** Each polyline vertex pushed sideways by `offset` (mitred), for painted edge lines. */
function offsetPolyline(points: readonly Vector2[], offset: number): Vector2[] {
  return points.map((point, i) => {
    const before = normalize(sub(point, points[Math.max(0, i - 1)]));
    const after = normalize(sub(points[Math.min(points.length - 1, i + 1)], point));
    const ends = i === 0 || i === points.length - 1;
    const tangent = normalize(i === 0 ? after : i === points.length - 1 ? before : add(before, after));
    const normal = { x: -tangent.y, y: tangent.x };
    const miter = ends ? 1 : Math.max(0.5, dot(normal, { x: -after.y, y: after.x }));
    return add(point, scale(normal, offset / miter));
  });
}

/** The polyline up to the point nearest `target`, when it passes within `tolerance` of it. */
function cutAtPoint(points: readonly Vector2[], target: Vector2, tolerance: number): Vector2[] | undefined {
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    const span = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(target, a), span) / (dot(span, span) || 1)));
    const p = add(a, scale(span, t));
    if (Math.hypot(p.x - target.x, p.y - target.y) <= tolerance) return [...points.slice(0, i), p];
  }
  return undefined;
}

/**
 * Taxiways as asphalt connectors in three passes: a soft shoulder; the asphalt
 * with thin yellow edge lines, a curved fillet where it leaves the runway, and a
 * hold-short bar; then the continuous yellow guide line. The first two passes go
 * under the apron, so the apron edge cuts each taxiway cleanly at any angle and
 * the two always join; the guide line runs on over the apron to its taxilane.
 */
export function paintTaxiwaySurface(
  graphics: Phaser.GameObjects.Graphics,
  taxiway: MapTaxiway,
  palette: CivilMapPalette,
  options: {
    readonly unit: number;
    readonly runways: readonly MapRunway[];
    readonly pass: "rim" | "surface" | "guide";
    readonly laneStarts?: readonly Vector2[];
    /** Where the stand approaches leave the taxiway; the guide line hands over to them there. */
    readonly handovers?: readonly Vector2[];
  },
): void {
  const runway = options.runways.find((item) => taxiway.connects.includes(item.id as never));
  const across = runway ? { x: -Math.sin(runway.angle), y: Math.cos(runway.angle) } : { x: 0, y: 0 };
  const offsetFromAxis = (p: Vector2) => (runway ? Math.abs((p.x - runway.center.x) * across.x + (p.y - runway.center.y) * across.y) : 0);
  const rounded = filletCorners(taxiway.path, options.unit * 0.05);
  // Run from the runway outward.
  const ordered = runway && offsetFromAxis(rounded[0]) > offsetFromAxis(rounded[rounded.length - 1]) ? [...rounded].reverse() : rounded;
  const width = taxiway.width;
  const flare = width * 0.9;
  // The taxiway ends where its apron taxilane starts (or runs its whole length, e.g. to a helipad).
  const asphalt = options.laneStarts?.map((start) => cutAtPoint(ordered, start, width / 2)).find(Boolean) ?? ordered;

  if (options.pass === "rim") {
    graphics.lineStyle(width + 4, mixColor(apronTones(palette).fill, PAVING.rim, 0.45), 1);
    strokePolyline(graphics, asphalt);
    return;
  }
  if (options.pass === "guide") {
    // Only runway taxiways carry a centre line; service links (to a helipad) are plain paving.
    if (!runway) return;
    const guide = guideStyle(palette, options.unit);
    graphics.lineStyle(guide.width, guide.color, 1);
    strokePolyline(graphics, options.handovers?.map((point) => cutAtPoint(asphalt, point, 1.5)).find(Boolean) ?? asphalt);
    return;
  }

  graphics.lineStyle(width, PAVING.runway, 1);
  strokePolyline(graphics, asphalt);
  // Where the taxiway leaves the runway edge, its asphalt widens to meet it.
  if (runway) {
    const edge = runway.width / 2;
    for (let i = 1; i < ordered.length; i += 1) {
      const [a, b] = [ordered[i - 1], ordered[i]];
      if (offsetFromAxis(b) < edge) continue;
      const t = Math.max(0, Math.min(1, (edge - offsetFromAxis(a)) / (offsetFromAxis(b) - offsetFromAxis(a) || 1)));
      graphics.fillStyle(PAVING.runway, 1);
      tracePolygon(graphics, fillet({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, normalize(sub(b, a)), unitVector(runway.angle), width, flare));
      graphics.fillPath();
      break;
    }
  }
  const edgeLine = Math.max(0.8, width * 0.06);
  graphics.lineStyle(edgeLine, palette.taxiwayMarking, 0.5);
  for (const side of [1, -1]) strokePolyline(graphics, offsetPolyline(asphalt, side * (width / 2 - edgeLine * 1.5)));

  // Hold-short bar where the path leaves the runway it connects to, past the fillet.
  if (!runway) return;
  const clearance = runway.width / 2 + flare * 1.3 + Math.max(4, width * 0.3);
  for (let i = 1; i < ordered.length; i += 1) {
    const [a, b] = [ordered[i - 1], ordered[i]];
    if (offsetFromAxis(b) < clearance) continue;
    const span = offsetFromAxis(b) - offsetFromAxis(a) || 1;
    const t = Math.max(0, Math.min(1, (clearance - offsetFromAxis(a)) / span));
    const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    const forward = unitVector(heading);
    const side = unitVector(heading + Math.PI / 2);
    const half = width * 0.5;
    graphics.lineStyle(Math.max(1.2, width * 0.08), palette.taxiwayMarking, 0.95);
    for (const step of [0, 1]) {
      const centre = add(at, scale(forward, step * width * 0.18));
      graphics.lineBetween(centre.x - side.x * half, centre.y - side.y * half, centre.x + side.x * half, centre.y + side.y * half);
    }
    for (const step of [2.2, 3.2]) {
      const centre = add(at, scale(forward, step * width * 0.18));
      for (let dash = -half; dash < half; dash += width * 0.24) {
        const end = Math.min(half, dash + width * 0.12);
        graphics.lineBetween(centre.x + side.x * dash, centre.y + side.y * dash, centre.x + side.x * end, centre.y + side.y * end);
      }
    }
    return;
  }
}

/** A tiny vector "L" or "C" so stand labels need no font at any scale. */
function paintTypeGlyph(graphics: Phaser.GameObjects.Graphics, at: Vector2, size: number, type: ApronStand["accepts"]): void {
  // Always upright so the letter reads at a glance whatever the stand heading.
  const p = (x: number, y: number) => ({ x: at.x + x * size, y: at.y - y * size });
  const strokes: [number, number][][] = type === "liner"
    ? [[[-0.3, 0.5], [-0.3, -0.5], [0.35, -0.5]]]
    : [[[0.35, 0.5], [-0.3, 0.5], [-0.3, -0.5], [0.35, -0.5]]];
  for (const stroke of strokes) {
    const points = stroke.map(([x, y]) => p(x, y));
    strokePolyline(graphics, points);
  }
}

/**
 * Whether scenery (a tree, bush, or stone) of `radius` at `point` stays off the
 * airfield: helipads, aprons, and runways are always drawn clear of it.
 */
export function clearOfAirfield(layout: PlayableMapLayout, point: Vector2, radius: number): boolean {
  const margin = radius + 4;
  if (layout.landingZones.some((zone) => zone.accepts === "rotor" && Math.hypot(zone.position.x - point.x, zone.position.y - point.y) < zone.captureRadius * 1.6 + margin)) return false;
  if (onApron(point, apronPolygons(layout), margin)) return false;
  const runways = (layout as Partial<{ runways: readonly MapRunway[] }>).runways ?? [];
  return !runways.some((runway) => {
    const dx = point.x - runway.center.x;
    const dy = point.y - runway.center.y;
    const along = dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle);
    const across = -dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle);
    return Math.abs(along) < runway.length / 2 + margin && Math.abs(across) < runway.width / 2 + margin;
  });
}

/**
 * Guide lines (taxiway centre lines, taxilanes, lead-ins) share one opaque yellow,
 * muted toward the concrete, so where paths overlap they never stack darker.
 */
function guideStyle(palette: CivilMapPalette, unit: number): { readonly color: number; readonly width: number } {
  return { color: mixColor(palette.taxiwayMarking, apronTones(palette).fill, 0.2), width: Math.max(1.4, unit * 0.0024) };
}

/** A stand's guide path as the aircraft follows it, from the taxiway onto the stand. */
export interface StandApproach {
  readonly standId: string;
  readonly points: readonly Vector2[];
}

/** Every distinct stand approach in the ground routes (both runway ends share most of them). */
export function standApproaches(routes: Readonly<Record<string, GroundRoute>> | undefined): StandApproach[] {
  const seen = new Map<string, StandApproach>();
  for (const route of Object.values(routes ?? {})) {
    for (const stand of route.stands) {
      if (!stand.approach || stand.approach.length < 2) continue;
      const key = `${stand.id}:${Math.round(stand.approach[0].x)}:${Math.round(stand.approach[0].y)}`;
      if (!seen.has(key)) seen.set(key, { standId: stand.id, points: stand.approach });
    }
  }
  return [...seen.values()];
}

/** Apron safety lines are red; muted so they never compete with traffic. */
const SAFETY_RED = 0xc0564a;

/**
 * Typed parking marked like a real stand: one smooth yellow guide per stand
 * (taxilane and lead-in, exactly the path its aircraft taxis), a white stop bar at the nose, a
 * red stand safety box, and an L or C mark in a muted aircraft type colour. A
 * dashed divider separates liner and commuter groups.
 * Everything stays quiet so the parking area never draws the eye from traffic.
 */
export function paintApronMarkings(
  graphics: Phaser.GameObjects.Graphics,
  markings: ApronMarkings | undefined,
  palette: CivilMapPalette,
  options: { readonly unit: number; readonly detailLevel: WorldDetailLevel; readonly approaches?: readonly StandApproach[] },
): void {
  if (!markings) return;
  const tones = apronTones(palette);
  const guide = guideStyle(palette, options.unit);
  const line = guide.width;
  // Taxilanes and lead-ins: each stand's approach, the path its aircraft taxis; shared stretches use identical points.
  graphics.lineStyle(guide.width, guide.color, 1);
  for (const approach of options.approaches ?? []) {
    const stand = markings.stands.find((item) => item.id === approach.standId);
    if (!stand) continue;
    // From where the taxiway guide hands over (the shared trunk), on along the stand centre line to the nose.
    strokePolyline(graphics, [...approach.points.slice(1), add(stand.position, scale(unitVector(stand.angle), stand.length * 0.42))]);
  }

  for (const stand of markings.stands) {
    const lane = markings.taxilanes.find((item) => item.id === stand.laneId);
    if (!lane || lane.path.length < 2) continue;
    const forward = unitVector(stand.angle);
    const across = { x: -forward.y, y: forward.x };
    const color = mixColor(AIRCRAFT_COLORS[stand.accepts], tones.fill, 0.4);
    // Stand safety box: a thin muted red line round the parked aircraft's footprint.
    graphics.lineStyle(1, mixColor(SAFETY_RED, tones.fill, 0.45), 0.8);
    tracePolygon(graphics, standCorners(stand));
    graphics.strokePath();
    const nose = add(stand.position, scale(forward, stand.length * 0.42));
    // Stop bar across the nose position.
    graphics.lineStyle(line * 1.8, palette.marking, 0.75);
    const half = stand.width * 0.22;
    graphics.lineBetween(nose.x - across.x * half, nose.y - across.y * half, nose.x + across.x * half, nose.y + across.y * half);
    // Stand identity beside the box's tail end, in a muted type colour.
    graphics.lineStyle(line * 1.1, color, 0.85);
    paintTypeGlyph(graphics, add(add(stand.position, scale(forward, -stand.length * 0.3)), scale(across, stand.width * 0.3)), stand.width * 0.16, stand.accepts);
  }

  graphics.lineStyle(line, tones.edge, 0.7);
  for (const [a, b] of markings.dividers) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dash = Math.max(3, options.unit * 0.008);
    for (let d = 0; d < length; d += dash * 2) {
      const t0 = d / length;
      const t1 = Math.min(1, (d + dash) / length);
      graphics.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
    }
  }
}

/**
 * The whole airfield ground in one pass order: taxiway shoulders and asphalt,
 * the apron concrete over their ends (so its edge cuts each taxiway cleanly),
 * the taxiway guide lines running on to the taxilanes, then the typed stand
 * markings. Runways are painted after.
 */
export function paintAirfieldGround(
  graphics: Phaser.GameObjects.Graphics,
  layout: PlayableMapLayout & { readonly runways: readonly MapRunway[]; readonly taxiways: readonly MapTaxiway[] },
  palette: CivilMapPalette,
  detailLevel: WorldDetailLevel,
): void {
  const unit = Math.min(layout.width, layout.height);
  const aprons = apronPolygons(layout);
  const laneStarts = (layout.apronMarkings?.taxilanes ?? []).map((lane) => lane.path[0]);
  const approaches = standApproaches(layout.groundRoutes);
  // An approach's second point is where its curve leaves the taxiway's straight stretch.
  const handovers = approaches.map((approach) => approach.points[1]);
  const taxiwayOptions = { unit, runways: layout.runways, laneStarts, handovers };
  for (const pass of ["rim", "surface"] as const) for (const taxiway of layout.taxiways) paintTaxiwaySurface(graphics, taxiway, palette, { ...taxiwayOptions, pass });
  paintApronArea(graphics, aprons, layout.apronMarkings, palette, { unit, detailLevel, jointAngle: layout.runways[0]?.angle, runways: layout.runways });
  for (const taxiway of layout.taxiways) paintTaxiwaySurface(graphics, taxiway, palette, { ...taxiwayOptions, pass: "guide" });
  paintApronMarkings(graphics, layout.apronMarkings, palette, { unit, detailLevel, approaches });
}
