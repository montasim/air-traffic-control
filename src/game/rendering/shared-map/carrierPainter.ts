import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type { Carrier, CarrierLanePaint } from "../../maps/shared/carrier";
import { pointInPolygon } from "../../maps/shared/apronLayout";
import { AIRCRAFT_COLORS } from "../../palette";
import { strokePolyline, tracePolygon } from "./geometry";
import { castAlpha, castReach } from "./lighting";

/** Navy greys: haze-grey hull and island over a darker non-skid deck, kept as quiet as the concrete aprons. */
const DECK = {
  shadow: 0x0d2730,
  hull: 0x5d6970,
  hullShade: 0x3c474d,
  deck: 0x535c61,
  seam: 0x454d52,
  rim: 0x7b878c,
  elevator: 0x555f64,
  elevatorEdge: 0x2c3337,
  line: 0xe9e6d8,
  wire: 0xc9c4b0,
  island: 0x8c9599,
  islandShade: 0x6b767b,
  islandTop: 0xb3bbbd,
  glass: 0x24343b,
} as const;

/** A point on the carrier given as shares of its length (x, stern to bow) and beam (y, starboard positive). */
const onCarrier = (carrier: Carrier, x: number, y: number): Vector2 => {
  const [cos, sin] = [Math.cos(carrier.angle), Math.sin(carrier.angle)];
  const [dx, dy] = [x * carrier.length, y * carrier.beam];
  return { x: carrier.center.x + dx * cos - dy * sin, y: carrier.center.y + dx * sin + dy * cos };
};
/** A rectangle on the carrier: centre in shares, size as shares of length and beam. */
const carrierBox = (carrier: Carrier, x: number, y: number, length: number, beam: number): Vector2[] =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onCarrier(carrier, x + (a * length) / 2, y + (b * beam) / 2));


const along = (lane: CarrierLanePaint, distance: number, offset = 0): Vector2 => ({
  x: lane.center.x + Math.cos(lane.angle) * distance - Math.sin(lane.angle) * offset,
  y: lane.center.y + Math.sin(lane.angle) * distance + Math.cos(lane.angle) * offset,
});

function paintLane(graphics: Phaser.GameObjects.Graphics, lane: CarrierLanePaint, unit: number): void {
  const half = lane.length / 2;
  const edge = lane.width / 2;
  const line = Math.max(1, unit * 0.0018);
  // A lane that takes no landings is not drawn: its bare outline read as stray lines on the deck.
  if (!lane.operational) return;
  graphics.lineStyle(line, DECK.line, 0.6);
  for (const side of [-1, 1]) strokePolyline(graphics, [along(lane, -half, side * edge), along(lane, half, side * edge)]);
  // Dashed centre line.
  graphics.lineStyle(line * 1.4, DECK.line, 0.75);
  const dash = Math.max(6, lane.width * 0.6);
  for (let d = -half + lane.width * 2.2; d < half - dash; d += dash * 2) {
    const [a, b] = [along(lane, d), along(lane, d + dash)];
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  // Touchdown bar in the commuter colour, then the arresting wires across the lane.
  graphics.lineStyle(Math.max(3, lane.width * 0.22), AIRCRAFT_COLORS.commuter, 0.85);
  const [barA, barB] = [along(lane, -half + lane.width * 0.5, -edge * 0.8), along(lane, -half + lane.width * 0.5, edge * 0.8)];
  graphics.lineBetween(barA.x, barA.y, barB.x, barB.y);
  graphics.lineStyle(Math.max(0.8, line * 0.8), DECK.wire, 0.6);
  for (const share of [0.12, 0.16, 0.2]) {
    const [a, b] = [along(lane, -half + lane.length * share, -edge), along(lane, -half + lane.length * share, edge)];
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
}

/**
 * Hull, flight deck and its markings, after a real supercarrier: the knife bow, the non-skid deck
 * with its seams, deck-edge elevators, and the landing lane. Deck parking and taxi guides are
 * painted after.
 */
export function paintCarrierDeck(graphics: Phaser.GameObjects.Graphics, carrier: Carrier, unit: number): void {
  const at = (x: number, y: number) => onCarrier(carrier, x, y);
  // A deck line from one share position to another, kept to the parts that lie on the deck.
  const deckLine = (x0: number, y0: number, x1: number, y1: number) => {
    let run: Vector2[] = [];
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const point = at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (pointInPolygon(point, carrier.deck)) run.push(point);
      else { if (run.length > 1) strokePolyline(graphics, run); run = []; }
    }
    if (run.length > 1) strokePolyline(graphics, run);
  };
  const fill = (points: readonly Vector2[], color: number, alpha = 1) => {
    graphics.fillStyle(color, alpha);
    tracePolygon(graphics, points);
    graphics.fillPath();
  };
  fill(carrier.hull.map((p) => ({ x: p.x + unit * 0.01, y: p.y + unit * 0.014 })), DECK.shadow, 0.4);
  fill(carrier.hull, DECK.hull);
  // The starboard half of the hull falls in shade, away from the north-west light.
  fill(carrier.hull.filter((_, i) => i >= 1 && i <= 5).concat([at(0.2, 0), at(-0.48, 0)]), DECK.hullShade, 0.6);
  fill(carrier.deck, DECK.deck);
  // Non-skid panels: faint seams along and across the deck.
  graphics.lineStyle(Math.max(1, unit * 0.0012), DECK.seam, 0.7);
  for (const y of [-0.3, -0.05, 0.2, 0.42]) deckLine(-0.48, y, 0.28, y);
  for (let x = -0.4; x < 0.3; x += 0.1) deckLine(x, -0.3, x, 0.42);
  // Deck-edge elevators, flush with the edge: two to starboard aft of the island, one to port aft.
  for (const [x, y] of [[-0.36, 0.5], [-0.2, 0.52], [-0.38, -0.33]] as const) {
    const box = carrierBox(carrier, x, y, 0.07, 0.22);
    fill(box, DECK.elevator);
    graphics.lineStyle(Math.max(1, unit * 0.0014), DECK.elevatorEdge, 0.8);
    tracePolygon(graphics, box);
    graphics.strokePath();
  }
  // The deck edge: a dark catwalk rim with a pale safety line just inside it.
  graphics.lineStyle(Math.max(2, unit * 0.004), DECK.hullShade, 1);
  tracePolygon(graphics, carrier.deck);
  graphics.strokePath();
  graphics.lineStyle(1.2, DECK.rim, 0.9);
  tracePolygon(graphics, carrier.deck);
  graphics.strokePath();
  for (const lane of carrier.paintedLanes) paintLane(graphics, lane, unit);
}

/**
 * The island superstructure, drawn above parked traffic like the other buildings: a tall shadow,
 * a stepped block with its shaded side, the bridge glazing facing forward, a radar mast, and the
 * square and round radar antennas on top.
 */
export function paintCarrierIsland(graphics: Phaser.GameObjects.Graphics, carrier: Carrier, unit: number): void {
  const { center, width, height, angle } = carrier.island;
  const corner = (x: number, y: number) => ({
    x: center.x + Math.cos(angle) * x - Math.sin(angle) * y,
    y: center.y + Math.sin(angle) * x + Math.cos(angle) * y,
  });
  const box = (w: number, h: number, dx = 0, dy = 0) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => corner(dx + (a * w) / 2, dy + (b * h) / 2));
  const fill = (points: readonly Vector2[], color: number, alpha = 1) => {
    graphics.fillStyle(color, alpha);
    tracePolygon(graphics, points);
    graphics.fillPath();
  };
  // A tall structure casts a long shadow down and to the right.
  fill(box(width, height).map((p) => ({ x: p.x + unit * 0.016 * castReach(), y: p.y + unit * 0.022 * castReach() })), DECK.shadow, castAlpha(0.35));
  fill(box(width, height), DECK.islandShade);
  fill(box(width * 0.94, height * 0.7, -width * 0.02, -height * 0.1), DECK.island);
  fill(box(width * 0.6, height * 0.5, -width * 0.06, -height * 0.12), DECK.islandTop);
  // Bridge glazing along the forward end.
  fill(box(width * 0.05, height * 0.6, width * 0.43, -height * 0.05), DECK.glass);
  // Mast and its yard, then the square and round radar antennas.
  const mast = corner(width * 0.1, -height * 0.1);
  graphics.lineStyle(Math.max(1.2, height * 0.08), DECK.hullShade, 1);
  strokePolyline(graphics, [corner(width * 0.1, -height * 0.45), corner(width * 0.1, height * 0.25)]);
  graphics.fillStyle(DECK.hullShade, 1);
  graphics.fillCircle(mast.x, mast.y, Math.max(1.5, height * 0.16));
  fill(box(width * 0.12, height * 0.32, -width * 0.24, -height * 0.12), DECK.glass, 0.85);
  const dome = corner(-width * 0.38, -height * 0.05);
  graphics.fillStyle(DECK.islandTop, 1);
  graphics.fillCircle(dome.x, dome.y, Math.max(1.5, height * 0.2));
  graphics.lineStyle(1, DECK.islandShade, 1);
  graphics.strokeCircle(dome.x, dome.y, Math.max(1.5, height * 0.2));
}

/**
 * An escort sailing with the carrier, seen from above: a narrow haze-grey hull with a
 * pointed bow, a stepped superstructure with a mast, a gun forward and a helicopter deck aft.
 * `kind` "supply" draws a fuller replenishment ship with cargo hatches instead.
 */
export function paintEscortShip(
  graphics: Phaser.GameObjects.Graphics,
  center: Vector2,
  angle: number,
  length: number,
  unit: number,
  kind: "destroyer" | "supply" = "destroyer",
): void {
  const beam = length * (kind === "supply" ? 0.16 : 0.12);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const at = (x: number, y: number): Vector2 => ({ x: center.x + x * length * cos - y * beam * sin, y: center.y + x * length * sin + y * beam * cos });
  const fill = (points: readonly Vector2[], color: number, alpha = 1) => {
    graphics.fillStyle(color, alpha);
    tracePolygon(graphics, points);
    graphics.fillPath();
  };
  const box = (x: number, y: number, l: number, b: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at(x + (u * l) / 2, y + (v * b) / 2));
  const hull = [at(0.52, 0), at(0.3, 0.5), at(0.05, 0.5), at(-0.5, 0.42), at(-0.5, -0.42), at(0.05, -0.5), at(0.3, -0.5)];
  fill(hull.map((p) => ({ x: p.x + unit * 0.006, y: p.y + unit * 0.009 })), DECK.shadow, 0.35);
  fill(hull, DECK.hull);
  fill([at(-0.5, 0.42), at(0.05, 0.5), at(0.3, 0.5), at(0.52, 0), at(0.1, 0)], DECK.hullShade, 0.45);
  if (kind === "supply") {
    // Cargo hatches along the deck, and the bridge block aft.
    for (const x of [0.28, 0.12, -0.04]) fill(box(x, 0, 0.11, 0.6), DECK.deck);
    fill(box(-0.3, 0, 0.18, 0.7), DECK.island);
    fill(box(-0.27, 0, 0.08, 0.5), DECK.islandTop);
    graphics.lineStyle(Math.max(1, beam * 0.08), DECK.hullShade, 1);
    for (const x of [0.2, 0.04]) strokePolyline(graphics, [at(x, -0.55), at(x, 0.55)]);
    return;
  }
  // Gun forward, the superstructure and mast amidships, and the helicopter deck aft.
  graphics.fillStyle(DECK.islandShade, 1);
  const gun = at(0.3, 0);
  graphics.fillCircle(gun.x, gun.y, beam * 0.18);
  strokePolyline(graphics, [gun, at(0.42, 0)]);
  fill(box(0.02, 0, 0.3, 0.7), DECK.islandShade);
  fill(box(0.04, 0, 0.22, 0.56), DECK.island);
  fill(box(0.08, 0, 0.07, 0.36), DECK.islandTop);
  const mast = at(-0.02, 0);
  graphics.fillStyle(DECK.hullShade, 1);
  graphics.fillCircle(mast.x, mast.y, beam * 0.12);
  fill(box(-0.38, 0, 0.18, 0.66), DECK.deck);
  graphics.lineStyle(Math.max(1, beam * 0.05), DECK.line, 0.6);
  tracePolygon(graphics, box(-0.38, 0, 0.12, 0.44));
  graphics.strokePath();
}
