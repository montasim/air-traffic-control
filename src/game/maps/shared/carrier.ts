import type { Vector2 } from '../../../core/types';
import type { MapHelipad, MapRunway, MapTaxiway } from './airfield';

/** The deck's one landing lane, along the port side. */
export type CarrierLane = 'axial';

export interface CarrierSpec {
  readonly id: string;
  readonly center: Vector2;
  /** Overall flight-deck length in pixels. */
  readonly length: number;
  /** Heading from stern to bow. */
  readonly angle: number;
  /** Deck helipads: one at the bow, a second at the aft starboard corner. */
  readonly pads: 1 | 2;
  readonly padRadius: number;
  readonly taxiwayWidth: number;
  /** Match the land runway width; deck length and landing-lane length stay authored. */
  readonly runwayWidth?: number;
}

/** A painted deck lane; operational ones are also the carrier's runways. */
export interface CarrierLanePaint {
  readonly kind: CarrierLane;
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly operational: boolean;
}

export interface Carrier {
  readonly id: string;
  readonly center: Vector2;
  readonly length: number;
  readonly beam: number;
  readonly angle: number;
  /** Waterline outline, under the deck's overhang. */
  readonly hull: Vector2[];
  /** Flight deck outline; also the deck apron that deck parking is laid out on. */
  readonly deck: Vector2[];
  readonly runways: MapRunway[];
  readonly paintedLanes: CarrierLanePaint[];
  readonly helipads: MapHelipad[];
  /** The island superstructure on the starboard edge. */
  readonly island: { readonly center: Vector2; readonly width: number; readonly height: number; readonly angle: number };
  /** Deck taxi lines from each landing lane to the parking area aft of the island. */
  readonly taxiways: MapTaxiway[];
}

/** Beam as a share of the deck length: wide enough for parking beside the lanes. */
const BEAM = 0.28;
/**
 * The deck outline as shares of length and beam, after a real supercarrier: a square stern, the
 * angled-deck overhang to port aft, a long tapering bow, and the starboard sponson by the island.
 * The aft starboard parking shelf fits full stand footprints even in compact layouts.
 */
const DECK = [
  [-0.5, -0.34], [-0.5, 0.72], [0.1, 0.82], [0.36, 0.5], [0.48, 0.2], [0.5, -0.06],
  [0.22, -0.3], [-0.05, -0.54], [-0.3, -0.54], [-0.43, -0.42],
] as const;

function insidePolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i], polygon[j]];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Builds a carrier in local deck coordinates — x from stern (−½) to bow (+½) as
 * a share of the length, y across the beam with starboard positive — and places
 * it in the world. Landings run from the stern toward the bow.
 */
export function createCarrier(spec: CarrierSpec): Carrier {
  const length = spec.length;
  const originalBeam = length * BEAM;
  // The runway occupies a useful share of the deck, rather than scaling the
  // entire ship up to preserve the old narrow painted stripe.
  const beam = Math.max(originalBeam, (spec.runwayWidth ?? 0) / 0.32);
  const [cos, sin] = [Math.cos(spec.angle), Math.sin(spec.angle)];
  const world = (x: number, y: number): Vector2 => ({
    x: spec.center.x + x * cos - y * sin,
    y: spec.center.y + x * sin + y * cos,
  });
  /** A point given as shares of length (x) and beam (y). */
  const at = (x: number, y: number) => world(x * length, y * beam);

  // Keep the port edge alongside the widened lane until its forward end.
  const deckShape = DECK.map(([x, y]) => [x === 0.22 ? 0.36 : x, y] as const);
  const deck = deckShape.map(([x, y]) => at(x, y));
  // The waterline hull: narrower than the flight deck it carries, with a long knife bow running
  // out past the deck's forward edge.
  const hull = [
    [-0.48, -0.26], [-0.48, 0.3], [-0.2, 0.4], [0.2, 0.38], [0.42, 0.22], [0.58, 0.04],
    [0.42, -0.12], [0.2, -0.24], [-0.2, -0.32],
  ].map(([x, y]) => at(x, y));

  const laneWidth = spec.runwayWidth ?? beam * 0.16;
  // One landing lane along the port side, as on a real carrier; the starboard side keeps the island
  // and a single row of parked aircraft along its edge.
  const laneStart = { x: -0.48 * length, y: -0.12 * beam };
  const localDeck = deckShape.map(([x, y]) => ({ x: x * length, y: y * beam }));
  // The lane runs only as far as the deck allows, its painted shoulder included, so no part of it
  // hangs over the sea.
  // Preserve the original longitudinal endpoints while widening only the deck beam.
  const originalWidth = originalBeam * 0.16;
  const originalDeck = DECK.map(([x, y]) => ({ x: x * length, y: y * originalBeam }));
  const shoulder = Math.max(2, originalWidth * 0.08);
  const margin = originalWidth * 0.5 + shoulder + 1;
  const fits = (x: number) => [-margin, margin].every((side) => insidePolygon({ x, y: -0.12 * originalBeam + side }, originalDeck));
  const step = length * 0.005;
  let from = laneStart.x;
  let to = laneStart.x + 0.8 * length;
  while (from < to && !fits(from - shoulder)) from += step;
  while (to > from && !fits(to + shoulder)) to -= step;
  const lane: CarrierLanePaint = { kind: 'axial', center: world((from + to) / 2, laneStart.y), length: to - from, width: laneWidth, angle: spec.angle, operational: true };
  const runways: MapRunway[] = [{
    id: `${spec.id}-axial`, accepts: 'commuter', center: lane.center, length: lane.length, width: lane.width, angle: lane.angle,
    zoneId: `${spec.id}-axial-zone`, designators: ['AX', 'AX'],
  }];

  // A short taxi line straight up from the lane to the parking row along the starboard edge, between
  // the island and the aft helicopter spot.
  const parking = world(-0.18 * length, 0.42 * beam);
  const taxiways: MapTaxiway[] = [{ id: `${runways[0].id}-taxi`, path: [world(-0.18 * length, laneStart.y), parking], width: spec.taxiwayWidth, connects: [runways[0].id, `${spec.id}-deck`] }];

  // Helicopter spots well apart: one at the bow, a second at the aft starboard corner.
  const padSpots = spec.pads === 2 ? [[0.4, 0.04], [-0.4, 0.3]] : [[0.4, 0.04]];
  const helipads: MapHelipad[] = padSpots.map(([x, y], index) => ({ center: at(x, y), radius: spec.padRadius, zoneId: `${spec.id}-pad-${index + 1}` }));

  // The island lies flush along the forward starboard deck edge, turned to follow it.
  const [edgeA, edgeB] = [localDeck[2], localDeck[3]];
  const edge = { x: edgeB.x - edgeA.x, y: edgeB.y - edgeA.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  const islandHeight = beam * 0.12;
  // Inward normal of the edge, towards the deck's centre line.
  const inward = { x: edge.y / edgeLength, y: -edge.x / edgeLength };
  const inset = islandHeight / 2 + length * 0.01;
  const island = {
    center: world((edgeA.x + edgeB.x) / 2 + inward.x * inset, (edgeA.y + edgeB.y) / 2 + inward.y * inset),
    width: edgeLength * 0.75,
    height: islandHeight,
    angle: spec.angle + Math.atan2(edge.y, edge.x),
  };

  return { id: spec.id, center: spec.center, length, beam, angle: spec.angle, hull, deck, runways, paintedLanes: [lane], helipads, island, taxiways };
}
