import type { LandingZone, Vector2 } from '../../../core/types';
import type { ApronMarkings, GroundRoute, GroundStand, PlayableMapLayout } from '../types';
import { buildingCenterClearOfRunways, filletCorners, PIVOT_TURN } from '../../rendering/shared-map/geometry';
import type { MapRunway, MapTaxiway, ParkingStand } from './airfield';

export { filletCorners, PIVOT_TURN };

/** A rotated rectangle the ground routes must not drive through (buildings, hangars, landmarks). */
export interface GroundObstacle {
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

/** The airfield data every map layout already carries for its scenery. */
export interface GroundNetwork {
  readonly runways: readonly Pick<MapRunway, 'id' | 'center' | 'length' | 'width' | 'angle'>[];
  readonly taxiways: readonly Pick<MapTaxiway, 'path' | 'connects'>[];
  readonly parkingStands?: readonly Pick<ParkingStand, 'id' | 'position' | 'angle'>[];
}

/** Civil and specialist layouts both expose runways and taxiways at the top level. */
export function hasGroundNetwork(layout: PlayableMapLayout): layout is PlayableMapLayout & GroundNetwork {
  const candidate = layout as Partial<GroundNetwork>;
  return Array.isArray(candidate.runways) && Array.isArray(candidate.taxiways);
}

const isRect = (value: unknown): value is GroundObstacle => {
  const rect = value as Partial<GroundObstacle> | undefined;
  return !!rect && typeof rect.width === 'number' && typeof rect.height === 'number' && !!rect.center;
};

/**
 * Collect obstacles from the different ways maps describe their buildings, at
 * the positions they are drawn (buildings overlapping a runway are pushed clear).
 */
export function groundObstacles(layout: PlayableMapLayout): GroundObstacle[] {
  const rich = layout as unknown as {
    runways?: GroundNetwork['runways'];
    buildings?: readonly unknown[];
    fixtures?: readonly unknown[];
    /** Structures that keep their authored place, such as a carrier's island. */
    fixedObstacles?: readonly unknown[];
    serviceLandmark?: unknown;
    propAnchors?: readonly { kind: string; position: Vector2; angle: number; size: number }[];
  };
  const runways = rich.runways ?? [];
  const drawn = (center: Vector2, width: number, height: number, angle: number): GroundObstacle =>
    ({ center: buildingCenterClearOfRunways(center, width, height, runways), width, height, angle });
  const obstacles: GroundObstacle[] = [];
  for (const building of [...(rich.buildings ?? []), ...(rich.fixtures ?? []), ...(rich.fixedObstacles ?? [])]) {
    if (isRect(building)) obstacles.push(drawn(building.center, building.width, building.height, building.angle ?? 0));
  }
  if (isRect(rich.serviceLandmark)) {
    const landmark = rich.serviceLandmark;
    obstacles.push(drawn(landmark.center, landmark.width, landmark.height, landmark.angle ?? 0));
  }
  const buildingCenters = [...(rich.buildings ?? []), ...(isRect(rich.serviceLandmark) ? [rich.serviceLandmark] : [])].filter(isRect).map((item) => item.center);
  for (const prop of rich.propAnchors ?? []) {
    // Only props drawn as solid buildings block taxiing; windsocks and fences do not.
    if (!BUILDING_PROPS.has(prop.kind)) continue;
    // A prop anchored on a building's centre describes that building rather than adding one.
    if (isAnchorOf(prop.position, buildingCenters)) continue;
    obstacles.push(drawn(prop.position, prop.size, prop.size * (prop.kind === 'hangar' ? 0.5 : 0.7), prop.angle));
  }
  return obstacles;
}

const BUILDING_PROPS = new Set(['hangar', 'service', 'fuel', 'utility']);
export const isAnchorOf = (position: Vector2, centers: readonly Vector2[]): boolean =>
  centers.some((center) => Math.hypot(center.x - position.x, center.y - position.y) < 0.5);
const STANDS_PER_ROUTE = 3;
/** A rollout shorter than this share of the runway looks abrupt, so the aircraft rolls on and back-taxis. */
const MIN_ROLLOUT_SHARE = 0.18;

const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vector2, k: number): Vector2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;
const distance = (a: Vector2, b: Vector2): number => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Vector2, b: Vector2, t: number): Vector2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** Where segment a→b first enters the (margin-expanded) rectangle, as 0..1, or undefined. */
export function segmentEntry(a: Vector2, b: Vector2, rect: GroundObstacle, margin = 0): number | undefined {
  const cos = Math.cos(-rect.angle);
  const sin = Math.sin(-rect.angle);
  const local = (p: Vector2) => ({ x: (p.x - rect.center.x) * cos - (p.y - rect.center.y) * sin, y: (p.x - rect.center.x) * sin + (p.y - rect.center.y) * cos });
  const p = local(a);
  const q = local(b);
  const half = { x: rect.width / 2 + margin, y: rect.height / 2 + margin };
  let enter = 0;
  let exit = 1;
  for (const axis of ['x', 'y'] as const) {
    const delta = q[axis] - p[axis];
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(p[axis]) > half[axis]) return undefined;
      continue;
    }
    let t0 = (-half[axis] - p[axis]) / delta;
    let t1 = (half[axis] - p[axis]) / delta;
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return undefined;
  }
  return enter;
}

/** Stop the taxi part of a route just before it would enter any obstacle. */
function cutAtObstacles(points: readonly Vector2[], firstTaxiIndex: number, obstacles: readonly GroundObstacle[], margin: number): Vector2[] {
  for (let i = firstTaxiIndex; i < points.length - 1; i += 1) {
    let earliest: number | undefined;
    for (const obstacle of obstacles) {
      const entry = segmentEntry(points[i], points[i + 1], obstacle, margin);
      if (entry !== undefined && (earliest === undefined || entry < earliest)) earliest = entry;
    }
    if (earliest !== undefined) {
      const cut = lerp(points[i], points[i + 1], Math.max(0, earliest - 0.001));
      return [...points.slice(0, i + 1), cut].filter((point, index, all) => index === 0 || distance(point, all[index - 1]) > 1);
    }
  }
  return [...points];
}

function distanceToLine(point: Vector2, origin: Vector2, direction: Vector2): number {
  const offset = sub(point, origin);
  return Math.abs(offset.x * direction.y - offset.y * direction.x);
}

/** A taxiway oriented from its runway junction toward the apron, stopped short of buildings. */
export interface TaxiExit {
  readonly runwayId: string;
  readonly accepts: MapRunway['accepts'] | undefined;
  readonly path: readonly Vector2[];
  readonly apronEnd: Vector2;
  /** Heading of the last segment, pointing onto the apron. */
  readonly heading: number;
}

/** Every runway-to-apron taxiway, shared by stand placement and ground routes so both agree on the apron end. */
export function taxiwayExits(network: GroundNetwork & { readonly runways: readonly { readonly accepts?: MapRunway['accepts'] }[] }, obstacles: readonly GroundObstacle[], unit: number): TaxiExit[] {
  const exits: TaxiExit[] = [];
  for (const runway of network.runways) {
    const axis = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
    for (const taxiway of network.taxiways) {
      if (!taxiway.connects.includes(runway.id) || taxiway.path.length < 2) continue;
      const first = taxiway.path[0];
      const last = taxiway.path[taxiway.path.length - 1];
      const oriented = distanceToLine(first, runway.center, axis) <= distanceToLine(last, runway.center, axis)
        ? [...taxiway.path]
        : [...taxiway.path].reverse();
      const path = cutAtObstacles(oriented, 0, obstacles, unit * 0.012);
      const apronEnd = path[path.length - 1];
      const before = path[path.length - 2] ?? oriented[0];
      exits.push({ runwayId: runway.id, accepts: (runway as { accepts?: MapRunway['accepts'] }).accepts, path, apronEnd, heading: Math.atan2(apronEnd.y - before.y, apronEnd.x - before.x) });
    }
  }
  return exits;
}

/** Stands for one route: typed apron stands, in lane order (nearest first), reached along their taxilane and lead-in. */
/** Curve radius for the turns from taxiway to taxilane to stand, shared by motion and paint. */
export const standTurnRadius = (stand: { readonly length: number }): number => stand.length * 0.6;

const withoutRepeats = (points: readonly Vector2[]): Vector2[] =>
  points.filter((point, index, all) => index === 0 || distance(point, all[index - 1]) > 1);

/** Arc length along a polyline to the point on it nearest `target`. */
function distanceAlong(points: readonly Vector2[], target: Vector2): number {
  let best = { gap: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    const span = sub(b, a);
    const length = Math.hypot(span.x, span.y);
    const t = length ? Math.max(0, Math.min(1, dot(sub(target, a), span) / (length * length))) : 0;
    const gap = distance(target, lerp(a, b, t));
    if (gap < best.gap) best = { gap, along: walked + t * length };
    walked += length;
  }
  return best.along;
}

/** Arc length along the trunk from which it runs straight down the lane (its last leg). */
function straightFrom(trunk: readonly Vector2[], lane: readonly Vector2[]): number {
  if (lane.length < 2) return 0;
  const [a, b] = [lane[lane.length - 2], lane[lane.length - 1]];
  const direction = sub(b, a);
  const length = Math.hypot(direction.x, direction.y) || 1;
  const offLine = (point: Vector2) => Math.abs((point.x - a.x) * direction.y - (point.y - a.y) * direction.x) / length;
  let k = trunk.length - 1;
  while (k > 0 && offLine(trunk[k - 1]) < 0.5) k -= 1;
  let walked = 0;
  for (let i = 1; i <= k; i += 1) walked += distance(trunk[i - 1], trunk[i]);
  return walked;
}

/** The polyline from its start up to `along` (arc length), ending on an interpolated point. */
function prefixOf(points: readonly Vector2[], along: number): Vector2[] {
  const result: Vector2[] = [points[0]];
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const length = distance(points[i - 1], points[i]);
    if (walked + length >= along) {
      result.push(lerp(points[i - 1], points[i], length ? (along - walked) / length : 0));
      return result;
    }
    walked += length;
    result.push(points[i]);
  }
  return result;
}

/**
 * Each typed stand's approach: from the last straight stretch of the taxiway
 * (`before` → `end`) along one shared, rounded taxilane trunk, then off it on a
 * curve into the stand. Every stand on a lane shares the trunk's exact points, so
 * the painted guide lines lie on top of each other without the slightest shift,
 * and the aircraft follow those same lines.
 */
function apronStandsFor(zone: LandingZone, before: Vector2, end: Vector2, apron: ApronMarkings): GroundStand[] {
  const stands = apron.stands.filter((stand) => stand.accepts === zone.accepts);
  const trunks = new Map<string, Vector2[]>();
  return stands.map((stand) => {
    // A taxilane path is [taxiway end, near lane end, far lane end]; stand entries lie on the lane.
    const lane = apron.taxilanes.find((item) => item.id === stand.laneId)?.path ?? [end];
    if (!trunks.has(stand.laneId)) trunks.set(stand.laneId, filletCorners(withoutRepeats([before, end, ...lane]), standTurnRadius(stand)));
    const trunk = trunks.get(stand.laneId)!;
    const atEntry = distanceAlong(trunk, stand.entry);
    // Leave the trunk a short way before the entry and curve onto the stand centre line,
    // starting on the lane's straight stretch so the turn never exceeds a right angle.
    const turn = Math.max(0, Math.min(stand.length * 0.5, atEntry - straightFrom(trunk, lane)));
    const shared = prefixOf(trunk, atEntry - turn);
    const entry = prefixOf(trunk, atEntry).at(-1)!;
    const branch = turn > 1 ? filletCorners([shared[shared.length - 1], entry, stand.position], turn) : [entry, stand.position];
    return { id: stand.id, position: stand.position, angle: stand.angle, accepts: stand.accepts, length: stand.length, approach: [...shared, ...branch.slice(1)] };
  });
}

/**
 * Builds one presentation route per fixed-wing landing zone: roll out along the
 * runway in the landing direction, leave by the first taxiway far enough ahead
 * (or roll on and back-taxi when none is), then taxi toward the apron, stopping
 * short of buildings. With apron markings, each stand of the zone's type is
 * reached along its taxilane and lead-in; otherwise a stand is used only when
 * reachable in a straight line, or the aircraft parks at the route end.
 */
export function createGroundRoutes(
  zones: readonly LandingZone[],
  network: GroundNetwork,
  unit: number,
  obstacles: readonly GroundObstacle[] = [],
  apron?: ApronMarkings,
): Record<string, GroundRoute> {
  const routes: Record<string, GroundRoute> = {};
  const runwayRects: GroundObstacle[] = network.runways.map((runway) => ({ center: runway.center, width: runway.length, height: runway.width, angle: runway.angle }));
  const stands: GroundStand[] = (network.parkingStands ?? []).map((stand) => ({ id: stand.id, position: stand.position, angle: stand.angle }));
  const exits = taxiwayExits(network, obstacles, unit);
  for (const zone of zones) {
    if (!zone.approach) continue;
    const runway = network.runways.find((item) => item.id === zone.approach!.runwayId);
    if (!runway) continue;
    const direction = { x: Math.cos(zone.angle), y: Math.sin(zone.angle) };
    const links = exits
      .filter((exit) => exit.runwayId === runway.id)
      .map((exit) => ({ path: exit.path, along: dot(sub(exit.path[0], zone.position), direction) }));
    if (!links.length) continue;

    const minimumRoll = runway.length * MIN_ROLLOUT_SHARE;
    const ahead = links.filter((link) => link.along >= minimumRoll).sort((a, b) => a.along - b.along)[0];
    const link = ahead ?? [...links].sort((a, b) => b.along - a.along)[0];
    const junction = add(zone.position, scale(direction, link.along));
    let raw: Vector2[];
    let rolloutLength: number;
    if (ahead) {
      raw = [zone.position, junction, ...link.path];
      rolloutLength = link.along;
    } else {
      // No exit ahead: roll most of the remaining runway, pivot, and taxi back to the exit.
      const farEnd = dot(sub(add(runway.center, scale(direction, runway.length / 2)), zone.position), direction);
      const stopAlong = Math.max(minimumRoll, farEnd - runway.length * 0.06);
      raw = [zone.position, add(zone.position, scale(direction, stopAlong)), junction, ...link.path];
      rolloutLength = stopAlong;
    }
    const deduped = raw.filter((point, index) => index === 0 || distance(point, raw[index - 1]) > 1);
    const points = filletCorners(deduped, unit * 0.05);
    const end = points[points.length - 1];
    const typed = apron ? apronStandsFor(zone, points[points.length - 2] ?? zone.position, end, apron) : [];
    if (typed.length) {
      routes[zone.id] = { points, rolloutLength, stands: typed };
      continue;
    }
    const reachable = stands
      .filter((stand) => distance(stand.position, end) <= unit * 0.25)
      .filter((stand) => ![...runwayRects, ...obstacles].some((rect) => segmentEntry(end, stand.position, rect, unit * 0.004) !== undefined))
      .sort((a, b) => distance(a.position, end) - distance(b.position, end))
      .slice(0, STANDS_PER_ROUTE);
    const before = points[points.length - 2] ?? zone.position;
    // Without a reachable stand the aircraft parks where the route ends, facing along it.
    const parkHere: GroundStand = { id: `end:${Math.round(end.x)}:${Math.round(end.y)}`, position: end, angle: Math.atan2(end.y - before.y, end.x - before.x), accepts: zone.accepts === 'rotor' ? undefined : zone.accepts };
    routes[zone.id] = { points, rolloutLength, stands: reachable.length ? reachable : [parkHere] };
  }
  return routes;
}
