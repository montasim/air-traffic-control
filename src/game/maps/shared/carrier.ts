import type { Vector2 } from '../../../core/types';
import type { MapHelipad, MapRunway, MapTaxiway } from './airfield';

/** Which deck lanes take landings: the axial lane along the hull, the angled lane off to port, or both. */
export type CarrierLane = 'axial' | 'angled';

export interface CarrierSpec {
  readonly id: string;
  readonly center: Vector2;
  /** Overall flight-deck length in pixels. */
  readonly length: number;
  /** Heading from stern to bow. */
  readonly angle: number;
  readonly lanes: readonly CarrierLane[];
  /** Deck helipads: one at the bow, a second forward of the island. */
  readonly pads: 1 | 2;
  readonly padRadius: number;
  readonly taxiwayWidth: number;
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
  /** Wake trails behind the stern (scenery). */
  readonly wake: Vector2[][];
}

/** Beam as a share of the deck length: wide enough for parking beside the lanes. */
const BEAM = 0.34;
/** The deck outline as shares of length and beam; the aft starboard parking shelf fits full stand footprints even in compact layouts. */
const DECK = [
  [-0.5, -0.34], [-0.5, 0.6], [0.1, 0.7], [0.36, 0.46], [0.5, 0.16], [0.5, -0.12],
  [0.2, -0.3], [-0.05, -0.5], [-0.3, -0.5], [-0.42, -0.4],
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
  const beam = length * BEAM;
  const [cos, sin] = [Math.cos(spec.angle), Math.sin(spec.angle)];
  const world = (x: number, y: number): Vector2 => ({
    x: spec.center.x + x * cos - y * sin,
    y: spec.center.y + x * sin + y * cos,
  });
  /** A point given as shares of length (x) and beam (y). */
  const at = (x: number, y: number) => world(x * length, y * beam);

  const deck = DECK.map(([x, y]) => at(x, y));
  const hull = [
    [-0.49, -0.3], [-0.49, 0.36], [0.1, 0.44], [0.36, 0.4], [0.55, 0.02], [0.36, -0.18],
    [0.2, -0.26], [-0.05, -0.42], [-0.3, -0.42], [-0.42, -0.34],
  ].map(([x, y]) => at(x, y));

  const laneWidth = beam * 0.16;
  // Axial lane along the centre line; the second lane parallel to it, off to port.
  // The second lane (still called "angled") runs parallel to the axial one on the port side with a
  // clear gap, rather than crossing it at an angle, so the two never overlap.
  const axialStart = { x: -0.48 * length, y: 0 };
  const angledStart = { x: -0.46 * length, y: -0.25 * beam };
  const localDeck = DECK.map(([x, y]) => ({ x: x * length, y: y * beam }));
  // Each lane runs only as far as the deck allows, its painted shoulder included, so no part of
  // a runway or its outline hangs over the sea.
  const fitted = (start: Vector2, wanted: number, localAngle: number) => {
    const along = { x: Math.cos(localAngle), y: Math.sin(localAngle) };
    const margin = laneWidth * 0.5 + Math.max(2, laneWidth * 0.08) + 1;
    const fits = (s: number) => [-margin, margin].every((side) =>
      insidePolygon({ x: start.x + along.x * s - along.y * side, y: start.y + along.y * s + along.x * side }, localDeck));
    let from = 0;
    let to = wanted;
    const step = length * 0.005;
    while (from < to && !fits(from - Math.max(2, laneWidth * 0.08))) from += step;
    while (to > from && !fits(to + Math.max(2, laneWidth * 0.08))) to -= step;
    const middle = (from + to) / 2;
    return { center: world(start.x + along.x * middle, start.y + along.y * middle), length: to - from, forwardEnd: start.x + along.x * to };
  };
  const axial = fitted(axialStart, 0.7 * length, 0);
  const angled = fitted(angledStart, 0.6 * length, 0);
  const lanes: CarrierLanePaint[] = [
    { kind: 'axial', center: axial.center, length: axial.length, width: laneWidth, angle: spec.angle, operational: spec.lanes.includes('axial') },
    { kind: 'angled', center: angled.center, length: angled.length, width: laneWidth, angle: spec.angle, operational: spec.lanes.includes('angled') },
  ];
  const runways: MapRunway[] = lanes.filter((lane) => lane.operational).map((lane) => ({
    id: `${spec.id}-${lane.kind}`,
    accepts: 'commuter',
    center: lane.center,
    length: lane.length,
    width: lane.width,
    angle: lane.angle,
    zoneId: `${spec.id}-${lane.kind}-zone`,
    // Axial and angled lanes read apart at a glance on the approach labels.
    designators: lane.kind === 'axial' ? ['AX', 'AX'] : ['AN', 'AN'],
  }));

  // Parking is the aft starboard shelf. The axial lane taxis straight across to it; the port lane
  // taxis forward round the axial lane's end and back, so no taxi line crosses a landing lane.
  const parking = world(-0.15 * length, 0.2 * beam);
  const around = axial.forwardEnd + laneWidth * 1.2;
  const taxiways: MapTaxiway[] = runways.map((runway) => {
    const path = runway.id.endsWith('angled')
      ? [world(angled.forwardEnd - laneWidth, angledStart.y), world(around, -0.14 * beam), world(around, 0.2 * beam), parking]
      : [world(-0.15 * length, axialStart.y), parking];
    return { id: `${runway.id}-taxi`, path, width: spec.taxiwayWidth, connects: [runway.id, `${spec.id}-deck`] };
  });

  // Helicopter spots at the bow, ahead of the lanes and clear of the taxi route round them.
  const padSpots = spec.pads === 2 ? [[0.4, -0.02], [0.4, 0.2]] : [[0.38, 0.04]];
  const helipads: MapHelipad[] = padSpots.map(([x, y], index) => ({ center: at(x, y), radius: spec.padRadius, zoneId: `${spec.id}-pad-${index + 1}` }));

  const island = { center: at(0.05, 0.4), width: length * 0.14, height: beam * 0.12, angle: spec.angle };

  // Two wake trails spreading from the stern, and a faint broad wash between them.
  const stern = (y: number) => at(-0.5, y);
  const astern = (distance: number, spread: number) => world(-0.5 * length - distance, spread);
  const wake = [
    [stern(-0.18), astern(length * 0.9, -beam * 0.9), astern(length * 0.9, -beam * 0.55), stern(-0.06)],
    [stern(0.06), astern(length * 0.9, beam * 0.55), astern(length * 0.9, beam * 0.9), stern(0.18)],
    [stern(-0.3), astern(length * 1.4, -beam * 1.5), astern(length * 1.4, beam * 1.5), stern(0.3)],
  ];

  return { id: spec.id, center: spec.center, length, beam, angle: spec.angle, hull, deck, runways, paintedLanes: lanes, helipads, island, taxiways, wake };
}
