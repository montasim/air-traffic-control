import type Phaser from 'phaser';
import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS } from '../../palette';
import type { MapRunway } from '../shared/airfield';
import {
  clearOfAirfield,
  convexHull,
  deterministicUnit,
  localRunwayPoint,
  mixColor,
  tracePolygon,
  type CivilMapPalette
} from '../../rendering/shared-map';
import type { SaltmarshGatewayLayout } from './layout';

/**
 * A runway marked like a real one: a pale paved shoulder, a worn darker centre lane, edge lines,
 * darker blast pads, the class-coloured threshold bar players match, a few white
 * "piano key" threshold stripes, a centreline that breaks for the arrows ahead of each
 * landing end showing which way aircraft land.
 */
export function paintMarkedRunway(
  graphics: Phaser.GameObjects.Graphics,
  runway: MapRunway,
  palette: CivilMapPalette,
  landingZones: readonly LandingZone[]
): void {
  const halfLength = runway.length / 2;
  const halfWidth = runway.width / 2;
  const box = (fromAlong: number, toAlong: number, fromAcross: number, toAcross: number, color: number, alpha = 1) => {
    graphics.fillStyle(color, alpha);
    tracePolygon(graphics, [
      localRunwayPoint(runway, fromAlong, fromAcross),
      localRunwayPoint(runway, toAlong, fromAcross),
      localRunwayPoint(runway, toAlong, toAcross),
      localRunwayPoint(runway, fromAlong, toAcross)
    ]);
    graphics.fillPath();
  };
  const line = (fromAlong: number, fromAcross: number, toAlong: number, toAcross: number) => {
    const a = localRunwayPoint(runway, fromAlong, fromAcross);
    const b = localRunwayPoint(runway, toAlong, toAcross);
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  };
  const w = runway.width;
  const pad = Math.min(18, runway.length * 0.04);
  const shoulder = Math.max(2, w * 0.08);
  // Pale paved shoulder instead of a dark outline, then the runway asphalt.
  box(-halfLength - shoulder, halfLength + shoulder, -halfWidth - shoulder, halfWidth + shoulder, mixColor(palette.asphalt, palette.apron, 0.55));
  box(-halfLength, halfLength, -halfWidth, halfWidth, palette.asphalt);
  // Tyres wear the middle lane a little darker than the edges.
  box(-halfLength + pad, halfLength - pad, -w * 0.2, w * 0.2, mixColor(palette.asphalt, palette.shadow, 0.5), 0.14);
  // Continuous white edge lines along the usable length.
  const edge = Math.max(1, w * 0.03);
  const inset = w * 0.06;
  box(-halfLength + pad, halfLength - pad, -halfWidth + inset, -halfWidth + inset + edge, palette.marking, 0.6);
  box(-halfLength + pad, halfLength - pad, halfWidth - inset - edge, halfWidth - inset, palette.marking, 0.6);
  const keyLength = Math.min(20, runway.length * 0.04);
  for (const end of [-1, 1] as const) {
    // Along-runway position measured inward from this end.
    const at = (fromEnd: number) => end * (halfLength - fromEnd);
    // Blast pad: plain darker surface; chevrons here crowded the end with a third colour.
    box(Math.min(at(0), at(pad)), Math.max(at(0), at(pad)), -halfWidth, halfWidth, mixColor(palette.asphalt, palette.shadow, 0.3));
    // The class-coloured threshold bar stays the main landing cue.
    graphics.lineStyle(Math.max(4, w * 0.15), AIRCRAFT_COLORS[runway.accepts], 1);
    line(at(pad + w * 0.075), -halfWidth + inset, at(pad + w * 0.075), halfWidth - inset);
    // Piano keys: a few short, slightly worn stripes either side of the centreline. No aiming-point
    // blocks: they clashed with the landing arrows and made the runway noisy.
    const keys = Math.max(2, Math.round(w / 24));
    const keyWidth = (halfWidth - inset * 2) / (keys * 2);
    const keyStart = pad + w * 0.25;
    for (const side of [-1, 1]) {
      for (let k = 0; k < keys; k += 1) {
        const from = side * (w * 0.1 + k * keyWidth * 2);
        box(at(keyStart), at(keyStart + keyLength), from, from + side * keyWidth, palette.marking, 0.7);
      }
    }
  }
  // White centreline dashes between the piano keys at each end, with a gap where the landing
  // arrows sit so the arrows read on their own.
  const usable = runway.length - (pad + w * 0.25 + keyLength + 14) * 2;
  const count = Math.max(3, Math.floor(usable / 44));
  const spacing = usable / count;
  const axis = { x: Math.cos(runway.angle), y: Math.sin(runway.angle) };
  const arrowAlong = landingZones
    .filter((zone) => zone.approach?.runwayId === runway.id)
    .flatMap((zone) => [0.1, 0.16].map((step) => {
      const tip = { x: zone.position.x + Math.cos(zone.angle) * runway.length * step, y: zone.position.y + Math.sin(zone.angle) * runway.length * step };
      return (tip.x - runway.center.x) * axis.x + (tip.y - runway.center.y) * axis.y;
    }));
  const arrowSize = Math.min(halfWidth * 0.55, 9);
  graphics.lineStyle(Math.max(1.5, w * 0.05), palette.marking, 0.7);
  for (let index = 0; index < count; index += 1) {
    const center = -usable / 2 + spacing * (index + 0.5);
    if (arrowAlong.some((along) => Math.abs(along - center) < spacing * 0.22 + arrowSize * 1.6)) continue;
    const a = localRunwayPoint(runway, center - spacing * 0.22);
    const b = localRunwayPoint(runway, center + spacing * 0.22);
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  // The class letter sign beside the runway, as on every other map.
  const sign = localRunwayPoint(runway, -halfLength + 34, halfWidth + 23);
  graphics.fillStyle(palette.marking, 1);
  graphics.fillRoundedRect(sign.x - 13, sign.y - 13, 26, 26, 6);
  graphics.lineStyle(3, 0x294b46, 1);
  graphics.strokeRoundedRect(sign.x - 13, sign.y - 13, 26, 26, 6);
  graphics.lineBetween(sign.x - 4, sign.y - 6, sign.x - 4, sign.y + 6);
  graphics.lineBetween(sign.x - 4, sign.y + 6, sign.x + 5, sign.y + 6);
  if (runway.accepts === "commuter") graphics.lineBetween(sign.x - 4, sign.y - 6, sign.x + 5, sign.y - 6);
  // Landing-direction arrows just past each landing threshold.
  graphics.fillStyle(palette.marking, 0.85);
  for (const zone of landingZones) {
    if (zone.approach?.runwayId !== runway.id) continue;
    const forward = { x: Math.cos(zone.angle), y: Math.sin(zone.angle) };
    const side = { x: -forward.y, y: forward.x };
    const size = Math.min(halfWidth * 0.55, 9);
    for (const step of [0.1, 0.16]) {
      const tip = { x: zone.position.x + forward.x * runway.length * step, y: zone.position.y + forward.y * runway.length * step };
      graphics.fillTriangle(
        tip.x + forward.x * size, tip.y + forward.y * size,
        tip.x - forward.x * size + side.x * size * 0.7, tip.y - forward.y * size + side.y * size * 0.7,
        tip.x - forward.x * size - side.x * size * 0.7, tip.y - forward.y * size - side.y * size * 0.7
      );
    }
  }
}

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
function paintCanopy(graphics: Phaser.GameObjects.Graphics, crowns: readonly { x: number; y: number; r: number }[], palette: CivilMapPalette): void {
  graphics.fillStyle(palette.shadow, 0.3);
  for (const c of crowns) graphics.fillCircle(c.x + c.r * 0.6, c.y + c.r * 0.5, c.r);
  graphics.fillStyle(mixColor(palette.vegetation, palette.shadow, 0.35), 1);
  for (const c of crowns) graphics.fillCircle(c.x, c.y, c.r);
  graphics.fillStyle(palette.vegetation, 1);
  for (const c of crowns) graphics.fillCircle(c.x - c.r * 0.18, c.y - c.r * 0.18, c.r * 0.78);
  graphics.fillStyle(palette.vegetationLight, 0.9);
  for (const c of crowns) graphics.fillCircle(c.x - c.r * 0.38, c.y - c.r * 0.38, c.r * 0.36);
}

/** Forest clumps in the band along the map edges, wherever they stay clear of the airfield and ponds. */
export function paintForests(graphics: Phaser.GameObjects.Graphics, layout: SaltmarshGatewayLayout, palette: CivilMapPalette, clumps: number): void {
  const unit = Math.min(layout.width, layout.height);
  const band = unit * 0.16;
  const ponds = layout.tidalPools.map((pool) => pool.reduce((sum, point) => ({ x: sum.x + point.x / pool.length, y: sum.y + point.y / pool.length }), { x: 0, y: 0 }));
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
    if (ponds.some((pond) => Math.hypot(pond.x - edge.x, pond.y - edge.y) < radius + unit * 0.08)) continue;
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
export function paintHedgerows(graphics: Phaser.GameObjects.Graphics, layout: SaltmarshGatewayLayout, palette: CivilMapPalette): void {
  const unit = Math.min(layout.width, layout.height);
  const bushes: { x: number; y: number; r: number }[] = [];
  layout.fieldPolygons.forEach((field, f) => {
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
        if (clearOfAirfield(layout, point, r + unit * 0.03)) bushes.push({ ...point, r });
      }
    });
  });
  paintCanopy(graphics, bushes, palette);
}

/**
 * A control tower beside the apron tip nearest the terminal, with two fuel tanks: a square
 * shaft with shaded walls, an octagonal glazed cab on top, and one shadow cast from both.
 */
export function paintControlTower(graphics: Phaser.GameObjects.Graphics, layout: SaltmarshGatewayLayout, palette: CivilMapPalette): void {
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
  const cast = { x: height * 0.86, y: height * 0.68 };
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
  graphics.fillStyle(palette.shadow, 0.3);
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
    graphics.fillStyle(palette.shadow, 0.28);
    graphics.fillCircle(tank.x + unit * 0.006, tank.y + unit * 0.005, unit * 0.011);
    graphics.fillStyle(0xd9dcd4, 1);
    graphics.fillCircle(tank.x, tank.y, unit * 0.011);
    graphics.lineStyle(Math.max(1, unit * 0.0015), 0x8b918d, 1);
    graphics.strokeCircle(tank.x, tank.y, unit * 0.007);
  }
}
