import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type { Carrier, CarrierLanePaint } from "../../maps/shared/carrier";
import { AIRCRAFT_COLORS } from "../../palette";
import { strokePolyline, tracePolygon } from "./geometry";

/** Muted deck greys: the deck is the carrier's apron, so it stays as quiet as the concrete ones. */
const DECK = {
  shadow: 0x0d2730,
  hull: 0x3f4b52,
  deck: 0x56636a,
  rim: 0x7b878c,
  line: 0xe9e6d8,
  wire: 0xc9c4b0,
  foul: 0xb86a5c,
  island: 0x8c9599,
  islandTop: 0xb3bbbd,
  wake: 0xf2f7f6,
} as const;

const along = (lane: CarrierLanePaint, distance: number, offset = 0): Vector2 => ({
  x: lane.center.x + Math.cos(lane.angle) * distance - Math.sin(lane.angle) * offset,
  y: lane.center.y + Math.sin(lane.angle) * distance + Math.cos(lane.angle) * offset,
});

/** Wake trails behind the stern; painted with the sea, under everything else. */
export function paintCarrierWake(graphics: Phaser.GameObjects.Graphics, carrier: Carrier): void {
  const [trailA, trailB, wash] = carrier.wake;
  graphics.fillStyle(DECK.wake, 0.05);
  tracePolygon(graphics, wash);
  graphics.fillPath();
  graphics.fillStyle(DECK.wake, 0.15);
  for (const trail of [trailA, trailB]) {
    tracePolygon(graphics, trail);
    graphics.fillPath();
  }
}

function paintLane(graphics: Phaser.GameObjects.Graphics, lane: CarrierLanePaint, unit: number): void {
  const half = lane.length / 2;
  const edge = lane.width / 2;
  const line = Math.max(1, unit * 0.0018);
  // Edge lines; a lane that takes no landings is only outlined, faintly.
  graphics.lineStyle(line, DECK.line, lane.operational ? 0.6 : 0.28);
  for (const side of [-1, 1]) strokePolyline(graphics, [along(lane, -half, side * edge), along(lane, half, side * edge)]);
  if (!lane.operational) return;
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
  // Red foul line on the starboard side, behind which deck parking sits.
  graphics.lineStyle(line, DECK.foul, 0.7);
  const foul = edge + 4;
  for (let d = -half; d < half; d += dash * 1.6) {
    const [a, b] = [along(lane, d, foul), along(lane, Math.min(half, d + dash), foul)];
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
}

/** Hull, flight deck, and lane markings. Deck parking and taxi guides are painted after, by the airfield ground pass. */
export function paintCarrierDeck(graphics: Phaser.GameObjects.Graphics, carrier: Carrier, unit: number): void {
  graphics.fillStyle(DECK.shadow, 0.35);
  tracePolygon(graphics, carrier.hull.map((p) => ({ x: p.x + unit * 0.008, y: p.y + unit * 0.012 })));
  graphics.fillPath();
  graphics.fillStyle(DECK.hull, 1);
  tracePolygon(graphics, carrier.hull);
  graphics.fillPath();
  graphics.fillStyle(DECK.deck, 1);
  tracePolygon(graphics, carrier.deck);
  graphics.fillPath();
  graphics.lineStyle(1.5, DECK.rim, 0.85);
  tracePolygon(graphics, carrier.deck);
  graphics.strokePath();
  for (const lane of carrier.paintedLanes) paintLane(graphics, lane, unit);
}

/** The island superstructure, drawn above parked traffic like the other buildings. */
export function paintCarrierIsland(graphics: Phaser.GameObjects.Graphics, carrier: Carrier, unit: number): void {
  const { center, width, height, angle } = carrier.island;
  const corner = (x: number, y: number) => ({
    x: center.x + Math.cos(angle) * x - Math.sin(angle) * y,
    y: center.y + Math.sin(angle) * x + Math.cos(angle) * y,
  });
  const box = (w: number, h: number, dx = 0, dy = 0) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => corner(dx + (a * w) / 2, dy + (b * h) / 2));
  graphics.fillStyle(DECK.shadow, 0.4);
  tracePolygon(graphics, box(width, height).map((p) => ({ x: p.x + unit * 0.006, y: p.y + unit * 0.009 })));
  graphics.fillPath();
  graphics.fillStyle(DECK.island, 1);
  tracePolygon(graphics, box(width, height));
  graphics.fillPath();
  graphics.fillStyle(DECK.islandTop, 1);
  tracePolygon(graphics, box(width * 0.55, height * 0.6, -width * 0.08));
  graphics.fillPath();
  // Mast.
  const mast = corner(width * 0.12, 0);
  graphics.fillStyle(DECK.hull, 1);
  graphics.fillCircle(mast.x, mast.y, Math.max(1.5, height * 0.18));
}
