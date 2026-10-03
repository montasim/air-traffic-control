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
const ANGLED_DECK = (-9 * Math.PI) / 180;

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

  const deck = [
    [-0.5, -0.34], [-0.5, 0.4], [0.1, 0.5], [0.36, 0.46], [0.5, 0.16], [0.5, -0.12],
    [0.2, -0.3], [-0.05, -0.5], [-0.3, -0.5], [-0.42, -0.4],
  ].map(([x, y]) => at(x, y));
  const hull = [
    [-0.49, -0.3], [-0.49, 0.36], [0.1, 0.44], [0.36, 0.4], [0.55, 0.02], [0.36, -0.18],
    [0.2, -0.26], [-0.05, -0.42], [-0.3, -0.42], [-0.42, -0.34],
  ].map(([x, y]) => at(x, y));

  const laneWidth = beam * 0.16;
  // Axial lane along the hull, port of the centre line; angled lane from the stern off to port.
  const axialStart = { x: -0.48 * length, y: -0.04 * beam };
  const axialLength = 0.7 * length;
  const angledStart = { x: -0.46 * length, y: -0.08 * beam };
  const angledLength = 0.6 * length;
  const laneCenter = (start: Vector2, laneLength: number, localAngle: number) =>
    world(start.x + (Math.cos(localAngle) * laneLength) / 2, start.y + (Math.sin(localAngle) * laneLength) / 2);
  const lanes: CarrierLanePaint[] = [
    { kind: 'axial', center: laneCenter(axialStart, axialLength, 0), length: axialLength, width: laneWidth, angle: spec.angle, operational: spec.lanes.includes('axial') },
    { kind: 'angled', center: laneCenter(angledStart, angledLength, ANGLED_DECK), length: angledLength, width: laneWidth, angle: spec.angle + ANGLED_DECK, operational: spec.lanes.includes('angled') },
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

  // Both lanes taxi to one parking point aft of the island, on the starboard side.
  const parking = world(-0.15 * length, 0.18 * beam);
  const angledAtParking = (-0.15 * length - angledStart.x) / Math.cos(ANGLED_DECK);
  const taxiways: MapTaxiway[] = runways.map((runway) => {
    const kind = runway.id.endsWith('angled') ? 'angled' : 'axial';
    const from = kind === 'axial'
      ? world(-0.15 * length, axialStart.y)
      : world(-0.15 * length, angledStart.y + Math.sin(ANGLED_DECK) * angledAtParking);
    return { id: `${runway.id}-taxi`, path: [from, parking], width: spec.taxiwayWidth, connects: [runway.id, `${spec.id}-deck`] };
  });

  const padSpots = spec.pads === 2 ? [[0.38, 0], [0.24, 0.24]] : [[0.38, 0.04]];
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
