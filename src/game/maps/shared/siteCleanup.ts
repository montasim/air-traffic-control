import type { Vector2 } from '../../../core/types';
import { buildingCenterClearOfRunways } from '../../rendering/shared-map/geometry';
import type { PlayableMapLayout } from '../types';
import { pointInPolygon, rectCorners, rectsOverlap, runwayApronGap, segmentHitsRect, standSize } from './apronLayout';
import { isAnchorOf, type GroundNetwork } from './groundRoutes';

type Runway = GroundNetwork['runways'][number];
type Taxiway = GroundNetwork['taxiways'][number] & { readonly width?: number };

const BUILDING_PROPS = new Set(['hangar', 'service', 'fuel', 'utility']);
/** Two buildings per apron leave room for the stands; the rest are left out. */
const MAX_BUILDINGS_PER_APRON = 2;
/** Sizes tried, largest first, when a building has to fit a crowded apron. */
const COMPACT_SCALES = [1, 0.85, 0.7];
const STEP = 2;
const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vector2, k: number): Vector2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;
const distance = (a: Vector2, b: Vector2): number => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a: Vector2, b: Vector2) => distance(a, b) < 0.5;
const normalize = (a: Vector2): Vector2 => scale(a, 1 / (Math.hypot(a.x, a.y) || 1));
const unitVector = (angle: number): Vector2 => ({ x: Math.cos(angle), y: Math.sin(angle) });
const centroid = (polygon: readonly Vector2[]): Vector2 =>
  polygon.reduce((sum, p) => ({ x: sum.x + p.x / polygon.length, y: sum.y + p.y / polygon.length }), { x: 0, y: 0 });
const runwayRect = (runway: Runway) => ({ center: runway.center, width: runway.length, height: runway.width, angle: runway.angle });


function polygonArea(polygon: readonly Vector2[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [a, b] = [polygon[i], polygon[(i + 1) % polygon.length]];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Sutherland–Hodgman against one half-plane: keeps points where dot(p, normal) >= offset. */
function clipHalfPlane(polygon: readonly Vector2[], normal: Vector2, offset: number): Vector2[] {
  const side = (p: Vector2) => p.x * normal.x + p.y * normal.y - offset;
  const result: Vector2[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const [a, b] = [polygon[i], polygon[(i + 1) % polygon.length]];
    const [da, db] = [side(a), side(b)];
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

/** Whether the polygon reaches into the runway and the clear strip along its sides. */
function overlapsStrip(polygon: readonly Vector2[], runway: Runway, clearance: number): boolean {
  const along = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
  const across = { x: -along.y, y: along.x };
  const strip = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => ({
    x: runway.center.x + along.x * (a * runway.length) / 2 + across.x * c * (runway.width / 2 + clearance),
    y: runway.center.y + along.y * (a * runway.length) / 2 + across.y * c * (runway.width / 2 + clearance),
  }));
  // Separating axes of both shapes.
  const axes = [along, across, ...polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return { x: -(b.y - a.y), y: b.x - a.x };
  })];
  return axes.every((axis) => {
    const project = (points: readonly Vector2[]) => points.map((p) => p.x * axis.x + p.y * axis.y);
    const [pa, pb] = [project(polygon), project(strip)];
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

/**
 * An apron never runs under or right up to a runway: where it reaches into the
 * runway or the clear strip beside it, it is cut back along that line, keeping the
 * larger side.
 */
export function apronClearOfRunways(polygon: readonly Vector2[], runways: readonly Runway[], clearance: number): Vector2[] {
  let result = [...polygon];
  for (const runway of runways) {
    if (result.length < 3 || !overlapsStrip(result, runway, clearance)) continue;
    const across = { x: -Math.sin(runway.angle), y: Math.cos(runway.angle) };
    const axis = runway.center.x * across.x + runway.center.y * across.y;
    const reach = runway.width / 2 + clearance;
    const below = clipHalfPlane(result, across, axis + reach);
    const above = clipHalfPlane(result, { x: -across.x, y: -across.y }, -(axis - reach));
    result = polygonArea(below) >= polygonArea(above) ? below : above;
  }
  return result;
}

interface Footprint {
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

/**
 * A runway-to-apron taxiway rebuilt as a straight connector at a right angle to
 * the runway: it leaves the runway centre line square, crosses the grass strip,
 * and runs a short way onto the apron. It sits as close as possible to where the
 * map placed the junction, never crosses another runway, and prefers a spot where
 * it and the apron space ahead of it are clear of buildings.
 */
export function straightConnector(
  taxiway: Taxiway,
  runway: Runway,
  aprons: readonly (readonly Vector2[])[],
  runways: readonly Runway[],
  unit: number,
  buildings: readonly Footprint[] = [],
): Vector2[] | undefined {
  const axis = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
  const across = { x: -axis.y, y: axis.x };
  const offset = (p: Vector2) => dot(sub(p, runway.center), across);
  const ordered = Math.abs(offset(taxiway.path[0])) <= Math.abs(offset(taxiway.path[taxiway.path.length - 1])) ? taxiway.path : [...taxiway.path].reverse();
  const far = ordered[ordered.length - 1];
  // The apron the taxiway was drawn to, or the nearest one.
  const apron = aprons.find((polygon) => pointInPolygon(far, polygon))
    ?? [...aprons].sort((a, b) => distance(centroid(a), far) - distance(centroid(b), far))[0];
  if (!apron) return undefined;
  const side = Math.sign(offset(centroid(apron))) || 1;
  const width = taxiway.width ?? unit * 0.016;
  const depth = Math.max(width * 1.6, unit * 0.03);
  const start = dot(sub(ordered[0], runway.center), axis);
  const limit = runway.length / 2 - runway.width * 1.5;
  const others = runways.filter((item) => item.id !== runway.id).map(runwayRect);
  const step = Math.max(2, unit * 0.008);
  // The roomiest spot wins: clear of buildings first, then the most open apron ahead,
  // then the nearest to where the map put the junction.
  let best: { path: Vector2[]; score: number } | undefined;
  const room = unit * 0.06;
  for (let k = 0; k < 400; k += 1) {
    const along = start + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
    if (Math.abs(along) > limit) {
      if (Math.ceil(k / 2) * step > runway.length) break;
      continue;
    }
    const base = add(runway.center, scale(axis, along));
    let entry: number | undefined;
    for (let t = runway.width / 2; t < unit * 0.7; t += STEP) {
      if (pointInPolygon(add(base, scale(across, side * t)), apron)) {
        entry = t;
        break;
      }
    }
    if (entry === undefined) continue;
    const end = add(base, scale(across, side * (entry + depth)));
    // The whole width must land on the apron, and the connector may not cross another runway.
    const sideways = scale(axis, width / 2);
    if (![end, add(end, sideways), sub(end, sideways)].every((p) => pointInPolygon(p, apron))) continue;
    if (others.some((rect) => segmentHitsRect(base, end, rect, width / 2))) continue;
    // Room ahead for the apron taxilane to start.
    const ahead = add(end, scale(across, side * depth * 1.5));
    const clear = !buildings.some((rect) => segmentHitsRect(base, ahead, rect, width / 2 + 4));
    // Open apron all round: probes on the apron and off buildings and helipads.
    const probes = [0.5, 1, 1.5].flatMap((reach) => Array.from({ length: 8 }, (_, i) => add(ahead, scale(unitVector((i * Math.PI) / 4), room * reach))));
    const open = probes.filter((p) => pointInPolygon(p, apron) && !buildings.some((rect) => segmentHitsRect(p, p, rect, 2))).length;
    const score = (clear ? 1000 : 0) + open * 10 - Math.abs(along - start) / runway.length;
    if (!best || score > best.score) best = { path: [base, end], score };
  }
  // On a crowded spot the buildings in the way move instead.
  return best?.path;
}

interface Site {
  readonly runways: readonly Runway[];
  readonly pads: readonly { readonly center: Vector2; readonly radius: number }[];
  readonly aprons: readonly (readonly Vector2[])[];
  /** Taxiway centre lines up to any building they lead into, with their half-width. */
  readonly paths: readonly { readonly points: readonly Vector2[]; readonly half: number }[];
  /** Buildings already settled, as authored and where they now stand; later ones keep clear of them. */
  readonly placed: { readonly authored: Footprint; readonly footprint: Footprint }[];
}

function nearestOnSegment(point: Vector2, a: Vector2, b: Vector2): Vector2 {
  const span = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(point, a), span) / (dot(span, span) || 1)));
  return add(a, scale(span, t));
}

/**
 * Moves a building until it sits wholly on the apron it stands on, clear of every
 * taxiway, helipad, runway, and building settled before it (unless the map drew
 * them touching, like a terminal's piers). Each rule nudges it a little; a few
 * passes settle any knock-on between them.
 */
function settle(footprint: Footprint, site: Site): Vector2 {
  let center = footprint.center;
  const at = (c: Vector2) => ({ ...footprint, center: c });
  const home = site.aprons.find((polygon) => pointInPolygon(center, polygon));
  const neighbours = site.placed.filter((item) => !rectsOverlap(item.authored, footprint, 1)).map((item) => item.footprint);
  for (let pass = 0; pass < 8; pass += 1) {
    const start = center;
    for (const other of neighbours) {
      for (let guard = 0; guard < 120 && rectsOverlap(at(center), other, 2); guard += 1) {
        const away = sub(center, other.center);
        center = add(center, scale(Math.hypot(away.x, away.y) > 0.5 ? normalize(away) : { x: 1, y: 0 }, STEP));
      }
    }
    if (home) {
      const target = centroid(home);
      for (let guard = 0; guard < 120 && !rectCorners(at(center)).every((corner) => pointInPolygon(corner, home)); guard += 1) {
        center = add(center, scale(normalize(sub(target, center)), STEP));
      }
    }
    for (const path of site.paths) {
      for (let i = 1; i < path.points.length; i += 1) {
        const [a, b] = [path.points[i - 1], path.points[i]];
        for (let guard = 0; guard < 120 && segmentHitsRect(a, b, at(center), path.half + 3); guard += 1) {
          const away = sub(center, nearestOnSegment(center, a, b));
          center = add(center, scale(Math.hypot(away.x, away.y) > 0.5 ? normalize(away) : normalize({ x: -(b.y - a.y), y: b.x - a.x }), STEP));
        }
      }
    }
    for (const pad of site.pads) {
      const offset = sub(center, pad.center);
      const length = Math.hypot(offset.x, offset.y) || 1;
      const direction = scale(offset, 1 / length);
      // Half the building's extent along the line from the pad centre.
      const extent = Math.max(...rectCorners(at({ x: 0, y: 0 })).map((p) => dot(p, direction)));
      const needed = pad.radius + extent + 2;
      if (length < needed) center = add(pad.center, scale(direction, needed));
    }
    center = buildingCenterClearOfRunways(center, footprint.width, footprint.height, site.runways);
    if (near(center, start)) break;
  }
  return center;
}

/** How many of a 5×5 grid of points over the footprint fall inside any of the areas. */
function samplesIn(footprint: Footprint, areas: readonly Footprint[]): number {
  const along = unitVector(footprint.angle);
  const across = { x: -along.y, y: along.x };
  let count = 0;
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      const p = add(footprint.center, add(scale(along, ((i - 2) / 4) * footprint.width), scale(across, ((j - 2) / 4) * footprint.height)));
      if (areas.some((area) => segmentHitsRect(p, p, area, 0))) count += 1;
    }
  }
  return count;
}

/** A taxiway's centre line up to where it first runs into one of the buildings, stopping short of it. */
function pathUpToBuildings(points: readonly Vector2[], buildings: readonly Footprint[], stopShort: number): Vector2[] {
  const inside = (p: Vector2) => buildings.some((rect) => segmentHitsRect(p, p, rect, 0));
  const result: Vector2[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / STEP));
    for (let k = 1; k <= steps; k += 1) {
      if (!inside({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps })) continue;
      // Stop short so the building the taxiway leads to is not pushed away from it.
      const back = Math.max(0, (k * length) / steps - stopShort) / (length || 1);
      result.push({ x: a.x + (b.x - a.x) * back, y: a.y + (b.y - a.y) * back });
      return result;
    }
    result.push(b);
  }
  return result;
}

/**
 * Tidies a map's airfield before stands are laid out, so it reads like a real one:
 * - aprons are cut back to leave a clear grass strip beside every runway;
 * - each runway-to-apron taxiway becomes a straight connector square to its runway,
 *   opening onto open apron;
 * - each apron keeps its two main buildings (and two free-standing fixtures),
 *   placed along its edge away from the connectors, so the space in front of each
 *   connector is left for stands; props and signs anchored on a building go with it.
 */
export function clearAirfieldSite<T extends PlayableMapLayout & GroundNetwork>(layout: T, unit: number): T {
  const record = layout as unknown as Record<string, unknown>;
  const runways = layout.runways;
  const changes: Record<string, unknown> = {};
  const aprons: Vector2[][] = [];
  for (const [key, value] of Object.entries(record)) {
    if (!/apron$/i.test(key) || !Array.isArray(value) || value.length < 3) continue;
    if (!value.every((point) => typeof (point as Vector2)?.x === 'number')) continue;
    const clipped = apronClearOfRunways(value as Vector2[], runways, runwayApronGap(unit));
    changes[key] = clipped;
    if (clipped.length >= 3) aprons.push(clipped);
  }

  type Building = Footprint & Record<string, unknown>;
  const isFootprints = (value: unknown): value is readonly Building[] =>
    Array.isArray(value) && value.every((item) => item && typeof item === 'object' && 'center' in item && typeof (item as Building).width === 'number');
  const buildings = isFootprints(record.buildings) ? record.buildings : undefined;
  const landmark = isFootprints([record.serviceLandmark]) ? (record.serviceLandmark as Building) : undefined;
  const fixtures = isFootprints(record.fixtures) ? record.fixtures : undefined;
  type Prop = { kind: string; position: Vector2; angle: number; size: number };
  const props = Array.isArray(record.propAnchors) ? (record.propAnchors as readonly Prop[]) : undefined;
  const propFootprint = (prop: Prop): Footprint => ({ center: prop.position, width: prop.size, height: prop.size * (prop.kind === 'hangar' ? 0.5 : 0.7), angle: prop.angle });
  const mainCenters = [...(buildings ?? []), ...(landmark ? [landmark] : [])].map((item) => item.center);

  const padSquares: Footprint[] = layout.landingZones
    .filter((zone) => zone.accepts === 'rotor')
    .map((zone) => ({ center: zone.position, width: zone.captureRadius * 2.4, height: zone.captureRadius * 2.4, angle: 0 }));

  // Straight, square connectors; taxiways that could not be rebuilt keep their authored path.
  const rebuilt: [readonly Vector2[], Vector2[]][] = [];
  // Each connector reserves the apron space it opens onto, so the next one finds its own.
  const reserved: Footprint[] = [];
  const taxiways = (layout.taxiways as readonly Taxiway[]).map((taxiway) => {
    const runway = runways.find((item) => taxiway.connects.includes(item.id as never));
    const path = runway && aprons.length ? straightConnector(taxiway, runway, aprons, runways, unit, [...padSquares, ...reserved]) : undefined;
    if (!path) return taxiway;
    const [base, end] = path;
    const direction = normalize(sub(end, base));
    const size = unit * 0.12;
    reserved.push({ center: add(end, scale(direction, size / 2 + 4)), width: size, height: size, angle: Math.atan2(direction.y, direction.x) });
    rebuilt.push([taxiway.path, path]);
    return { ...taxiway, path };
  });
  changes.taxiways = taxiways;

  // Buildings: at most two per apron, the main ones, placed along the apron edge away from
  // where the taxiways arrive, so the open apron in front of each connector is left for stands.
  // The apron a building belongs to: the one it stands on, or the nearest one just beside it.
  const edgeDistance = (point: Vector2, polygon: readonly Vector2[]) =>
    Math.min(...polygon.map((a, i) => distance(point, nearestOnSegment(point, a, polygon[(i + 1) % polygon.length]))));
  const apronIndexOf = (point: Vector2): number => {
    const inside = aprons.findIndex((polygon) => pointInPolygon(point, polygon));
    if (inside >= 0) return inside;
    let nearest = -1;
    for (const [index, polygon] of aprons.entries()) {
      if (edgeDistance(point, polygon) < unit * 0.15 && (nearest < 0 || edgeDistance(point, polygon) < edgeDistance(point, aprons[nearest]))) nearest = index;
    }
    return nearest;
  };
  const footprintOf = (item: Building): Footprint => ({ center: item.center, width: item.width, height: item.height, angle: item.angle ?? 0 });
  const structures = [
    ...(landmark ? [{ key: 'landmark', footprint: footprintOf(landmark), main: true }] : []),
    ...(buildings ?? []).map((item, index) => ({ key: `building:${index}`, footprint: footprintOf(item), main: index === 0 })),
    ...(props ?? []).flatMap((prop, index) => (BUILDING_PROPS.has(prop.kind) && !isAnchorOf(prop.position, mainCenters) ? [{ key: `prop:${index}`, footprint: propFootprint(prop), main: false }] : [])),
  ].map((item) => ({ ...item, apron: apronIndexOf(item.footprint.center), area: item.footprint.width * item.footprint.height }));
  const removed = new Set<string>();
  for (const [index] of aprons.entries()) {
    const onThis = structures.filter((item) => item.apron === index).sort((a, b) => Number(b.main) - Number(a.main) || b.area - a.area);
    for (const item of onThis.slice(MAX_BUILDINGS_PER_APRON)) removed.add(item.key);
  }

  const gap = runwayApronGap(unit);
  const margin = unit * 0.012;
  const connectorEnds = rebuilt.map(([, path]) => path[path.length - 1]);
  // The apron space each connector opens onto is kept for its stand row.
  const standRoom: Footprint[] = rebuilt.map(([, path]) => {
    const [base, end] = path;
    const direction = normalize(sub(end, base));
    // Deep enough for a lane and a stand, wide enough for a row of two, sized like the liner stands.
    const stand = standSize('liner', unit);
    const depth = stand.length * 1.7;
    return { center: add(end, scale(direction, depth / 2)), width: depth, height: stand.width * 3.6, angle: Math.atan2(direction.y, direction.x) };
  });
  const segments = taxiways.map((taxiway) => ({ points: taxiway.path, half: (taxiway.width ?? unit * 0.016) / 2 }));
  const placedRects: Footprint[] = [];
  /** The best spot on the apron: wholly on it, clear of everything, hugging its edge, far from the connectors. */
  const place = (footprint: Footprint, apron: readonly Vector2[], keepStandRoom: boolean): Vector2 | undefined => {
    const xs = apron.map((p) => p.x);
    const ys = apron.map((p) => p.y);
    const step = Math.max(3, unit * 0.008);
    let best: { center: Vector2; score: number } | undefined;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
        const center = { x, y };
        const at = { ...footprint, center };
        if (!rectCorners({ ...at, width: at.width + margin * 2, height: at.height + margin * 2 }).every((corner) => pointInPolygon(corner, apron))) continue;
        if (runways.some((runway) => rectsOverlap(at, runwayRect(runway), gap / 2))) continue;
        if (padSquares.some((pad) => rectsOverlap(at, pad, 2))) continue;
        if (placedRects.some((other) => rectsOverlap(at, other, unit * 0.008))) continue;
        if (segments.some((path) => path.points.some((point, i) => i > 0 && segmentHitsRect(path.points[i - 1], point, at, path.half + margin)))) continue;
        // How much of the building would sit in the space kept for stands (sampled on a 5×5 grid).
        const crowding = samplesIn(at, standRoom);
        if (keepStandRoom && crowding > 0) continue;
        const edge = Math.min(...apron.map((a, i) => distance(center, nearestOnSegment(center, a, apron[(i + 1) % apron.length]))));
        const fromConnectors = Math.min(unit * 0.35, ...connectorEnds.map((end) => distance(end, center)));
        const score = fromConnectors - edge * 1.2 - distance(center, footprint.center) * 0.2 - crowding * unit * 0.05;
        if (!best || score > best.score) best = { center, score };
      }
    }
    return best?.center;
  };

  // A taxiway that leads into a main building (a terminal) ends at it rather than pushing it away.
  const mainBuildings = [...(buildings ?? []), ...(landmark ? [landmark] : [])].map(footprintOf);
  const site: Site = {
    runways,
    pads: layout.landingZones
      .filter((zone) => zone.accepts === 'rotor')
      .map((zone) => ({ center: zone.position, radius: zone.captureRadius * 1.05 })),
    aprons,
    paths: segments.map((path) => ({ points: pathUpToBuildings(path.points, mainBuildings, path.half + 6), half: path.half })),
    placed: [],
  };
  const moves: [Vector2, Vector2][] = [];
  /** Where a building goes and how compact it is drawn; undefined when a minor one has no room and is left out. */
  type Placement = { readonly center: Vector2; readonly scale: number };
  const scales = new Map<string, number>();
  const position = (footprint: Footprint, apron: number, main: boolean): Placement | undefined => {
    const polygon = aprons[apron];
    let placement: Placement | undefined;
    // A building that does not fit at full size is drawn a little more compact.
    for (const scale of polygon ? COMPACT_SCALES : []) {
      const sized = { ...footprint, width: footprint.width * scale, height: footprint.height * scale };
      const center = place(sized, polygon, true) ?? place(sized, polygon, false);
      if (center) {
        placement = { center, scale };
        break;
      }
    }
    if (!placement && !main && polygon) return undefined;
    placement ??= { center: settle(footprint, site), scale: 1 };
    const sized = { ...footprint, width: footprint.width * placement.scale, height: footprint.height * placement.scale, center: placement.center };
    placedRects.push(sized);
    site.placed.push({ authored: footprint, footprint: sized });
    if (!near(placement.center, footprint.center)) moves.push([footprint.center, placement.center]);
    scales.set(`${Math.round(footprint.center.x)}:${Math.round(footprint.center.y)}`, placement.scale);
    return placement;
  };
  const placedAt = new Map<string, Placement>();
  for (const item of [...structures].filter((entry) => !removed.has(entry.key)).sort((a, b) => Number(b.main) - Number(a.main) || b.area - a.area)) {
    const placement = position(item.footprint, item.apron, item.main);
    if (placement) placedAt.set(item.key, placement);
    else removed.add(item.key);
  }
  const resized = <Item extends Building>(item: Item, key: string): Item => {
    const placement = placedAt.get(key);
    return placement ? { ...item, center: placement.center, width: item.width * placement.scale, height: item.height * placement.scale } : item;
  };
  const removedCenters = structures.filter((item) => removed.has(item.key)).map((item) => item.footprint.center);
  const isRemoved = (point: Vector2) => isAnchorOf(point, removedCenters);
  if (buildings) {
    changes.buildings = buildings.flatMap((item, index) => (removed.has(`building:${index}`) ? [] : [resized(item, `building:${index}`)]));
  }
  if (landmark) changes.serviceLandmark = resized(landmark, 'landmark');

  // Apron fixtures: those built onto a main building (a terminal's gates) move with it;
  // free-standing ones (shelters, containers) are kept to two and placed like buildings.
  if (fixtures) {
    const attached = fixtures.filter((item) => mainBuildings.some((main) => rectsOverlap(footprintOf(item), main, 1)));
    const loose = fixtures.filter((item) => !attached.includes(item));
    const middle = Math.max(0, Math.floor((loose.length - MAX_BUILDINGS_PER_APRON) / 2));
    const kept = [...attached.slice(0, MAX_BUILDINGS_PER_APRON), ...loose.slice(middle, middle + MAX_BUILDINGS_PER_APRON)];
    changes.fixtures = fixtures.filter((item) => kept.includes(item)).flatMap((item) => {
      const footprint = footprintOf(item);
      if (attached.includes(item)) {
        // Built onto a main building: keep the same place on it, at the same scale.
        const main = mainBuildings.find((building) => rectsOverlap(footprint, building, 1))!;
        const shift = moves.find(([from]) => near(from, main.center));
        const factor = scales.get(`${Math.round(main.center.x)}:${Math.round(main.center.y)}`) ?? 1;
        const center = add(shift ? shift[1] : main.center, scale(sub(item.center, main.center), factor));
        return [{ ...item, center, width: item.width * factor, height: item.height * factor }];
      }
      const placement = position(footprint, apronIndexOf(item.center), false);
      return placement ? [{ ...item, center: placement.center, width: item.width * placement.scale, height: item.height * placement.scale }] : [];
    });
  }

  if (props) {
    changes.propAnchors = props.flatMap((prop, index) => {
      if (removed.has(`prop:${index}`) || isRemoved(prop.position)) return [];
      const linked = moves.find(([from]) => near(from, prop.position));
      if (linked) return [{ ...prop, position: linked[1] }];
      const placed = placedAt.get(`prop:${index}`);
      return [placed ? { ...prop, position: placed.center, size: prop.size * placed.scale } : prop];
    });
  }

  // Signs go with what they label: a moved building, or a rebuilt taxiway (set beside it, past the runway).
  const signs = record.signs as readonly { kind?: string; position: Vector2 }[] | undefined;
  if (Array.isArray(signs)) {
    changes.signs = signs.filter((sign) => sign.kind !== 'facility' || !isRemoved(sign.position)).map((sign) => {
      const linked = moves.find(([from]) => near(from, sign.position));
      if (linked) return { ...sign, position: linked[1] };
      const taxiway = sign.kind === 'taxiway' ? rebuilt.find(([old]) => old.some((point) => Math.hypot(point.x - sign.position.x, point.y - sign.position.y) < unit * 0.02)) : undefined;
      if (!taxiway) return sign;
      const [base, end] = taxiway[1];
      const direction = normalize(sub(end, base));
      return { ...sign, position: add(add(base, scale(sub(end, base), 0.62)), scale({ x: -direction.y, y: direction.x }, unit * 0.025)) };
    });
  }
  return { ...layout, ...changes };
}
