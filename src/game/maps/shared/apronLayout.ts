import type { Vector2 } from '../../../core/types';
import type { ApronMarkings, ApronStand, ApronTaxilane, HudExclusionZone, PlayableMapLayout } from '../types';
import type { GroundObstacle, TaxiExit } from './groundRoutes';

type FixedWing = ApronStand['accepts'];

export interface ApronInput {
  readonly width: number;
  readonly height: number;
  readonly unit: number;
  readonly exits: readonly TaxiExit[];
  readonly aprons: readonly (readonly Vector2[])[];
  /** Buildings and props, at their drawn positions. */
  readonly obstacles: readonly GroundObstacle[];
  readonly runways: readonly GroundObstacle[];
  readonly hud: readonly HudExclusionZone[];
  readonly standsPerType?: number;
}

/** Stand footprint per type: a share of the map unit with a floor that fits a parked aircraft on phones. */
const STAND_SIZE: Record<FixedWing, { readonly share: number; readonly minimum: number }> = {
  liner: { share: 0.05, minimum: 30 },
  commuter: { share: 0.044, minimum: 26 },
};
const TYPES: readonly FixedWing[] = ['liner', 'commuter'];
const LABEL: Record<FixedWing, string> = { liner: 'L', commuter: 'C' };

const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vector2, k: number): Vector2 => ({ x: a.x * k, y: a.y * k });
const unitVector = (angle: number): Vector2 => ({ x: Math.cos(angle), y: Math.sin(angle) });
const distance = (a: Vector2, b: Vector2): number => Math.hypot(a.x - b.x, a.y - b.y);
const normalizeAngle = (angle: number) => ((angle % Math.PI) + Math.PI) % Math.PI;
const angle0 = (a: Vector2, b: Vector2): number => Math.atan2(b.y - a.y, b.x - a.x);
const turnBetween = (from: number, to: number): number => Math.abs(Math.atan2(Math.sin(to - from), Math.cos(to - from)));
/** The sharpest turn a guide line may take between taxiway, connector, and taxilane (a right angle, plus a little). */
const MAX_GUIDE_TURN = (95 * Math.PI) / 180;

/** Every apron polygon a layout carries (one per airport, e.g. Twin Banks' east and west aprons). */
export function apronPolygons(layout: PlayableMapLayout): Vector2[][] {
  const polygons: Vector2[][] = [];
  for (const [key, value] of Object.entries(layout as unknown as Record<string, unknown>)) {
    if (!/apron$/i.test(key) || !Array.isArray(value) || value.length < 3) continue;
    if (value.every((point) => typeof (point as Vector2)?.x === 'number' && typeof (point as Vector2)?.y === 'number')) polygons.push(value as Vector2[]);
  }
  return polygons;
}

/** The grass strip kept between a runway edge and any apron or stand, so the two read as separate surfaces. */
export function runwayApronGap(unit: number): number {
  return Math.max(12, unit * 0.035);
}

export function standSize(type: FixedWing, unit: number): { length: number; width: number } {
  const length = Math.max(STAND_SIZE[type].minimum, unit * STAND_SIZE[type].share);
  return { length, width: length * 0.92 };
}

export function standFootprint(stand: ApronStand): GroundObstacle {
  return { center: stand.position, width: stand.length, height: stand.width, angle: stand.angle };
}

export function rectCorners(rect: GroundObstacle): Vector2[] {
  const along = unitVector(rect.angle);
  const across = { x: -along.y, y: along.x };
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => add(rect.center, add(scale(along, (a * rect.width) / 2), scale(across, (c * rect.height) / 2))));
}

/** Separating-axis test for two rotated rectangles, each grown by `margin`. */
export function rectsOverlap(a: GroundObstacle, b: GroundObstacle, margin: number): boolean {
  const grown = (rect: GroundObstacle) => ({ ...rect, width: rect.width + margin * 2, height: rect.height + margin * 2 });
  const [pa, pb] = [rectCorners(grown(a)), rectCorners(grown(b))];
  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const axis = unitVector(angle);
    const project = (points: Vector2[]) => points.map((p) => p.x * axis.x + p.y * axis.y);
    const [ra, rb] = [project(pa), project(pb)];
    if (Math.max(...ra) < Math.min(...rb) || Math.max(...rb) < Math.min(...ra)) return false;
  }
  return true;
}

export function pointInPolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i], polygon[j]];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Vector2, a: Vector2, b: Vector2): number {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length)) : 0;
  return distance(point, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

/** Inside an apron, or within `tolerance` of its edge. */
export function onApron(point: Vector2, aprons: readonly (readonly Vector2[])[], tolerance: number): boolean {
  return aprons.some((polygon) => pointInPolygon(point, polygon)
    || polygon.some((a, i) => distanceToSegment(point, a, polygon[(i + 1) % polygon.length]) <= tolerance));
}

/** Whether segment a→b passes through the rectangle grown by `margin` (sampled every 4 units). */
export function segmentHitsRect(a: Vector2, b: Vector2, rect: GroundObstacle, margin: number): boolean {
  const steps = Math.max(2, Math.ceil(distance(a, b) / 4));
  const along = unitVector(rect.angle);
  for (let i = 0; i <= steps; i += 1) {
    const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
    const dx = p.x - rect.center.x;
    const dy = p.y - rect.center.y;
    if (Math.abs(dx * along.x + dy * along.y) <= rect.width / 2 + margin && Math.abs(-dx * along.y + dy * along.x) <= rect.height / 2 + margin) return true;
  }
  return false;
}

/** Whether segments a→b and c→d cross. */
function segmentsCross(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const side = (p: Vector2, q: Vector2, r: Vector2) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

/** Row directions worth trying: along each runway and apron edge, across them, and every 30°. */
function rowAngles(runways: readonly GroundObstacle[], aprons: readonly (readonly Vector2[])[]): number[] {
  const base = [...runways.map((rect) => rect.angle), ...aprons.flatMap((polygon) => polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }))];
  const angles: number[] = [];
  const sweep = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 6);
  for (const angle of [...base.flatMap((a) => [a, a + Math.PI / 2]), ...sweep]) {
    const n = normalizeAngle(angle);
    if (!angles.some((existing) => Math.abs(Math.sin(existing - n)) < 0.09)) angles.push(n);
  }
  return angles;
}

interface Row {
  readonly stands: ApronStand[];
  readonly lane: ApronTaxilane;
  readonly score: number;
}

/**
 * Places typed stand rows in open apron space. For each type, rows of stands are
 * tried across a grid of apron positions, along every runway and apron-edge
 * direction, with stands on either side of the row's taxilane. A row is kept only
 * when every stand sits on the apron clear of buildings, runways, the HUD, the
 * screen edge, and the other type's group, and both the lane and the connector
 * from the type's taxiway end avoid buildings and stands. The row with the
 * shortest connector wins, so each group sits near its own taxiway.
 */
export function createApronMarkings(input: ApronInput): ApronMarkings {
  const { width, height, unit, exits, aprons, obstacles, runways, hud } = input;
  const perType = input.standsPerType ?? 2;
  const stands: ApronStand[] = [];
  const taxilanes: ApronTaxilane[] = [];
  const dividers: (readonly [Vector2, Vector2])[] = [];
  const hudRects: GroundObstacle[] = hud.map((zone) => ({ center: { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }, width: zone.width, height: zone.height, angle: 0 }));
  const angles = rowAngles(runways, aprons);
  // Stands and taxilanes stay off the grass strip beside each runway.
  const runwayGap = runwayApronGap(unit);

  for (const type of TYPES) {
    const typeExits = exits.filter((exit) => exit.accepts === type);
    if (!typeExits.length) continue;
    const exit = [...typeExits].sort((a, b) => Number(onApron(b.apronEnd, aprons, unit * 0.04)) - Number(onApron(a.apronEnd, aprons, unit * 0.04)))[0];
    const start = exit.apronEnd;
    const { length, width: span } = standSize(type, unit);
    const spacing = span * 1.3;
    const laneGap = length * 0.3;
    const tail = span * 0.6;
    const others = stands.map(standFootprint);
    // Every other taxiway, and the apron just past its mouth, stays open for its own traffic.
    const otherMouths = exits.filter((item) => item !== exit).map((item) => {
      const last = item.path[item.path.length - 2] ?? item.apronEnd;
      return [last, add(item.apronEnd, scale(unitVector(item.heading), span * 1.6))] as const;
    });
    const step = span * 0.35;

    // A first pass keeps the groups well apart; if nothing fits, a second accepts a tighter apron.
    let relaxed = false;
    const pathClear = (a: Vector2, b: Vector2, skipStart: number) => {
      const along = distance(a, b);
      if (along <= skipStart) return true;
      const from = { x: a.x + ((b.x - a.x) * skipStart) / along, y: a.y + ((b.y - a.y) * skipStart) / along };
      return !obstacles.some((rect) => segmentHitsRect(from, b, rect, unit * 0.006))
        && !runways.some((rect) => segmentHitsRect(from, b, rect, runwayGap))
        && !others.some((rect) => segmentHitsRect(from, b, rect, span * (relaxed ? 0.05 : 0.2)))
        && !otherMouths.some(([m0, m1]) => segmentsCross(from, b, m0, m1));
    };

    let best: Row | undefined;
    // Passes: full rows, then single stands; each first with wide spacing, then relaxed.
    // A last pass lets one stand reach further off the authored apron; the painter paves under it.
    for (const pass of [0, 1, 2, 3, 4]) {
      if (best) break;
      relaxed = pass >= 2;
      const count = pass % 2 || pass === 4 ? 1 : perType;
      const overhang = pass === 4 ? 1.4 : 0.6;
      for (const polygon of aprons) {
        const xs = polygon.map((p) => p.x);
        const ys = polygon.map((p) => p.y);
        // Rows may overhang the authored apron edge by part of a stand; the painter paves under them.
        const reach = span * (pass === 4 ? 2.2 : 1.1);
        for (let cx = Math.min(...xs) - reach; cx <= Math.max(...xs) + reach; cx += step) {
          for (let cy = Math.min(...ys) - reach; cy <= Math.max(...ys) + reach; cy += step) {
            const center = { x: cx, y: cy };
            if (!onApron(center, [polygon], reach)) continue;
            for (const angle of angles) {
              const forward = unitVector(angle);
              const half = ((count - 1) / 2) * spacing + tail;
              const ends = [add(center, scale(forward, -half)), add(center, scale(forward, half))];
              // The connector joins the taxiway end to the nearer end of the row's lane.
              const [near, far] = distance(ends[0], start) <= distance(ends[1], start) ? ends : [ends[1], ends[0]];
              const connector = distance(near, start);
              if (connector > unit * (relaxed ? 0.6 : 0.4) || (best && connector >= best.score)) continue;
              if (!ends.every((point) => onApron(point, aprons, reach))) continue;
              if (!pathClear(start, near, span * 0.6) || !pathClear(near, far, 0)) continue;
              // Guide lines flow on from the taxiway: no turn along the way doubles back.
              const legs = [exit.heading, ...(connector > 1 ? [Math.atan2(near.y - start.y, near.x - start.x)] : []), angle0(near, far)];
              if (legs.some((heading, i) => i > 0 && turnBetween(legs[i - 1], heading) > MAX_GUIDE_TURN)) continue;
              for (const side of [1, -1]) {
                const standAngle = angle + (side * Math.PI) / 2;
                const trial: ApronStand[] = [];
                for (let i = 0; i < count; i += 1) {
                  const entry = add(center, scale(forward, (i - (count - 1) / 2) * spacing));
                  const position = add(entry, scale(unitVector(standAngle), laneGap + length / 2));
                  const footprint = { center: position, width: length, height: span, angle: standAngle };
                  const ok = rectCorners(footprint).every((corner) => onApron(corner, aprons, length * overhang)
                      && corner.x >= 4 && corner.x <= width - 4 && corner.y >= 4 && corner.y <= height - 4)
                    && !obstacles.some((rect) => rectsOverlap(footprint, rect, unit * 0.004))
                    // Both rectangles grow by the margin, so half the gap keeps the full gap between them.
                    && !runways.some((rect) => rectsOverlap(footprint, rect, runwayGap / 2 + 3))
                    && !hudRects.some((rect) => rectsOverlap(footprint, rect, 2))
                    // The other type's group keeps a clear gap, so the two groups read as separate.
                    && !others.some((rect) => rectsOverlap(footprint, rect, span * (relaxed ? 0.3 : 0.6)))
                    && !segmentHitsRect(start, near, footprint, 0)
                    && !otherMouths.some(([m0, m1]) => segmentHitsRect(m0, m1, footprint, span * 0.3));
                  if (!ok) break;
                  trial.push({ id: '', label: '', accepts: type, position, angle: standAngle, length, width: span, entry, laneId: `${type}-lane` });
                }
                if (trial.length !== count) continue;
                // Number stands from the connector side so the nearest is first.
                const ordered = [...trial].sort((a, b) => distance(a.entry, near) - distance(b.entry, near))
                  .map((stand, index) => ({ ...stand, id: `${type}-stand-${index + 1}`, label: `${LABEL[type]}${index + 1}` }));
                best = { stands: ordered, lane: { id: `${type}-lane`, path: [start, near, far] }, score: connector };
                break;
              }
            }
          }
        }
      }
    }

    if (best) {
      stands.push(...best.stands);
      taxilanes.push(best.lane);
    } else {
      // Nowhere to mark a stand: park where the taxiway meets the apron, facing along it.
      stands.push({ id: `${type}-stand-1`, label: `${LABEL[type]}1`, accepts: type, position: start, angle: exit.heading, length, width: span, entry: start, laneId: `${type}-lane` });
      taxilanes.push({ id: `${type}-lane`, path: [start] });
    }
  }

  // A painted divider between neighbouring liner and commuter groups on a shared apron.
  const liners = stands.filter((stand) => stand.accepts === 'liner');
  const commuters = stands.filter((stand) => stand.accepts === 'commuter');
  let closest: [ApronStand, ApronStand] | undefined;
  for (const a of liners) for (const b of commuters) if (!closest || distance(a.position, b.position) < distance(closest[0].position, closest[1].position)) closest = [a, b];
  if (closest && distance(closest[0].position, closest[1].position) < closest[0].width * 4) {
    const [a, b] = closest;
    const middle = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    const across = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x) + Math.PI / 2;
    dividers.push([add(middle, scale(unitVector(across), -a.length * 0.6)), add(middle, scale(unitVector(across), a.length * 0.6))]);
  }
  return { stands, taxilanes, dividers };
}
