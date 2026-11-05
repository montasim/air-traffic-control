import { AIRCRAFT_COLORS } from "../../palette";
import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type {
  MapHelipad,
  MapRunway,
  MapTaxiway,
} from "../../maps/shared/airfield";
import {
  buildingCenterClearOfRunways,
  localRunwayPoint,
  rotatedRectangle,
  strokePolyline,
  tracePolygon,
} from "./geometry";
import type { CivilMapPalette } from "./types";
import { mixColor } from "./apronPainter";

export interface MapBuilding {
  readonly id: string;
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly kind: "terminal" | "hangar" | "operations";
}

export function paintFieldPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  palette: CivilMapPalette,
  alternate = false,
): void {
  graphics.fillStyle(alternate ? palette.terrainLight : palette.terrain, 0.54);
  tracePolygon(graphics, points);
  graphics.fillPath();
  graphics.lineStyle(1, palette.fieldLine, 0.18);
  tracePolygon(graphics, points);
  graphics.strokePath();
}

export function paintWaterPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  palette: CivilMapPalette,
): void {
  graphics.fillStyle(palette.waterEdge, 0.52);
  tracePolygon(graphics, points);
  graphics.fillPath();
  const center = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  const inset = points.map((point) => ({
    x: point.x + (center.x / points.length - point.x) * 0.12,
    y: point.y + (center.y / points.length - point.y) * 0.12,
  }));
  graphics.fillStyle(palette.water, 0.92);
  tracePolygon(graphics, inset);
  graphics.fillPath();
}

export function paintRiver(
  graphics: Phaser.GameObjects.Graphics,
  path: readonly Vector2[],
  width: number,
  palette: CivilMapPalette,
): void {
  graphics.lineStyle(width * 1.34, palette.waterEdge, 0.62);
  strokePolyline(graphics, path);
  graphics.lineStyle(width, palette.water, 1);
  strokePolyline(graphics, path);
  graphics.lineStyle(Math.max(2, width * 0.17), palette.waterShallow, 0.24);
  strokePolyline(graphics, path);
}

export function paintApron(
  graphics: Phaser.GameObjects.Graphics,
  apron: readonly Vector2[],
  palette: CivilMapPalette,
): void {
  graphics.fillStyle(palette.airportGround, 0.92);
  tracePolygon(graphics, apron);
  graphics.fillPath();
  graphics.fillStyle(palette.apron, 0.96);
  const center = apron.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  const inset = apron.map((point) => ({
    x: point.x + (center.x / apron.length - point.x) * 0.08,
    y: point.y + (center.y / apron.length - point.y) * 0.08,
  }));
  tracePolygon(graphics, inset);
  graphics.fillPath();
}

export function paintTaxiway(
  graphics: Phaser.GameObjects.Graphics,
  taxiway: MapTaxiway,
  palette: CivilMapPalette,
): void {
  graphics.lineStyle(taxiway.width * 1.28, palette.asphaltEdge, 0.78);
  strokePolyline(graphics, taxiway.path);
  graphics.lineStyle(taxiway.width, palette.asphalt, 1);
  strokePolyline(graphics, taxiway.path);

}

/** A landing strip reads as one bold target at gameplay scale. */
export function paintRunway(
  graphics: Phaser.GameObjects.Graphics,
  runway: MapRunway,
  palette: CivilMapPalette,
  _wearCount = 0,
): void {
  const halfLength = runway.length / 2;
  const halfWidth = runway.width / 2;
  const signal = AIRCRAFT_COLORS[runway.accepts];
  const surface = (padding: number, color: number) => {
    const l = halfLength + padding, w = halfWidth + padding, r = 5;
    const points = [
      [-l + r, -w], [l - r, -w], [l, -w + r], [l, w - r],
      [l - r, w], [-l + r, w], [-l, w - r], [-l, -w + r],
    ].map(([along, across]) => localRunwayPoint(runway, along, across));
    graphics.fillStyle(color, 1);
    tracePolygon(graphics, points);
    graphics.fillPath();
  };
  surface(5, 0x294b46);
  surface(2, palette.marking);
  surface(0, 0x395b55);

  // A broad color bar replaces the tiny lights, numbers and threshold stripes.
  for (const end of [-1, 1]) {
    const along = end * (halfLength - 12);
    const a = localRunwayPoint(runway, along, -halfWidth + 5);
    const b = localRunwayPoint(runway, along, halfWidth - 5);
    graphics.lineStyle(9, signal, 1);
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  const usable = runway.length - 64;
  const count = Math.max(3, Math.floor(usable / 65));
  const spacing = usable / count;
  graphics.lineStyle(4, palette.marking, 0.92);
  for (let index = 0; index < count; index++) {
    const center = -usable / 2 + spacing * (index + 0.5);
    const a = localRunwayPoint(runway, center - spacing * 0.2);
    const b = localRunwayPoint(runway, center + spacing * 0.2);
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  const sign = localRunwayPoint(runway, -halfLength + 34, halfWidth + 23);
  graphics.fillStyle(palette.marking, 1);
  graphics.fillRoundedRect(sign.x - 13, sign.y - 13, 26, 26, 6);
  graphics.lineStyle(3, 0x294b46, 1);
  graphics.strokeRoundedRect(sign.x - 13, sign.y - 13, 26, 26, 6);
  graphics.lineBetween(sign.x - 4, sign.y - 6, sign.x - 4, sign.y + 6);
  graphics.lineBetween(sign.x - 4, sign.y + 6, sign.x + 5, sign.y + 6);
  if (runway.accepts === "commuter") {
    graphics.lineBetween(sign.x - 4, sign.y - 6, sign.x + 5, sign.y - 6);
  }

}

export function paintHelipad(
  graphics: Phaser.GameObjects.Graphics,
  helipad: MapHelipad,
  palette: CivilMapPalette,
): void {
  graphics.fillStyle(palette.asphaltEdge, 0.94);
  graphics.fillCircle(
    helipad.center.x,
    helipad.center.y,
    helipad.radius * 1.14,
  );
  graphics.fillStyle(palette.apron, 1);
  graphics.fillCircle(helipad.center.x, helipad.center.y, helipad.radius);
  graphics.lineStyle(
    Math.max(2, helipad.radius * 0.13),
    AIRCRAFT_COLORS.rotor,
    1,
  );
  graphics.strokeCircle(
    helipad.center.x,
    helipad.center.y,
    helipad.radius * 0.72,
  );
  const h = helipad.radius * 0.38;
  graphics.lineBetween(
    helipad.center.x - h,
    helipad.center.y - h,
    helipad.center.x - h,
    helipad.center.y + h,
  );
  graphics.lineBetween(
    helipad.center.x + h,
    helipad.center.y - h,
    helipad.center.x + h,
    helipad.center.y + h,
  );
  graphics.lineBetween(
    helipad.center.x - h,
    helipad.center.y,
    helipad.center.x + h,
    helipad.center.y,
  );
}

export function paintBuilding(
  graphics: Phaser.GameObjects.Graphics,
  building: MapBuilding,
  palette: CivilMapPalette,
  runways: readonly MapRunway[] = [],
): void {
  const center = buildingCenterClearOfRunways(building.center, building.width, building.height, runways);
  const points = rotatedRectangle(
    center,
    building.width,
    building.height,
    building.angle,
  );
  const shadow = points.map((point) => ({ x: point.x + 5, y: point.y + 7 }));
  graphics.fillStyle(palette.shadow, 0.34);
  tracePolygon(graphics, shadow);
  graphics.fillPath();
  graphics.fillStyle(palette.building, 1);
  tracePolygon(graphics, points);
  graphics.fillPath();
  graphics.lineStyle(
    Math.max(1, Math.min(building.width, building.height) * 0.08),
    palette.buildingRoof,
    0.62,
  );
  graphics.lineBetween(points[0].x, points[0].y, points[1].x, points[1].y);
  // Roof ridge, shallow eaves and skylights share the map's north-west light.
  const ridge = rotatedRectangle(
    center,
    building.width * 0.85,
    building.height * 0.18,
    building.angle,
  );
  graphics.fillStyle(palette.buildingRoof, 0.75);
  tracePolygon(graphics, ridge);
  graphics.fillPath();

}

/** Convex hull of a point set (monotone chain), for shadows cast by boxes. */
function convexHull(points: readonly Vector2[]): Vector2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vector2, a: Vector2, b: Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Vector2[]) => list.reduce<Vector2[]>((hull, point) => {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
    return hull;
  }, []);
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * A building drawn as a raised block for a light from the north-west: a shadow cast to the
 * south-east, walls shaded by the way they face, and a roof lifted by the building's height
 * with a lit edge and kind-specific detail (hangar ribs, terminal glazing, rooftop plant).
 */
export function paintRaisedBuilding(
  graphics: Phaser.GameObjects.Graphics,
  building: MapBuilding,
  palette: CivilMapPalette,
  unit: number,
  runways: readonly MapRunway[] = [],
): void {
  const center = buildingCenterClearOfRunways(building.center, building.width, building.height, runways);
  const base = rotatedRectangle(center, building.width, building.height, building.angle);
  const height = unit * (building.kind === "hangar" ? 0.02 : building.kind === "terminal" ? 0.016 : 0.012);
  const lift = { x: 0, y: -height * 0.55 };
  const roof = base.map((point) => ({ x: point.x + lift.x, y: point.y + lift.y }));
  const cast = { x: height * 0.95, y: height * 0.75 };
  graphics.fillStyle(palette.shadow, 0.3);
  tracePolygon(graphics, convexHull([...base, ...base.map((point) => ({ x: point.x + cast.x, y: point.y + cast.y }))]));
  graphics.fillPath();
  // Walls: darker the more they turn from the light.
  for (let i = 0; i < base.length; i += 1) {
    const a = base[i], b = base[(i + 1) % base.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
    const away = Math.max(0, normal.x * 0.6 + normal.y * 0.8);
    graphics.fillStyle(mixColor(palette.building, palette.shadow, 0.25 + away * 0.35), 1);
    tracePolygon(graphics, [a, b, roof[(i + 1) % roof.length], roof[i]]);
    graphics.fillPath();
  }
  graphics.fillStyle(mixColor(palette.building, palette.buildingRoof, 0.35), 1);
  tracePolygon(graphics, roof);
  graphics.fillPath();
  // Roof edges facing the light catch it.
  graphics.lineStyle(Math.max(1, unit * 0.0016), palette.buildingRoof, 0.85);
  for (let i = 0; i < roof.length; i += 1) {
    const a = roof[i], b = roof[(i + 1) % roof.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if ((b.y - a.y) / length * 0.6 - (b.x - a.x) / length * 0.8 < 0) graphics.lineBetween(a.x, a.y, b.x, b.y);
  }
  const along = { x: Math.cos(building.angle), y: Math.sin(building.angle) };
  const across = { x: -along.y, y: along.x };
  const roofCenter = { x: center.x + lift.x, y: center.y + lift.y };
  const at = (s: number, t: number): Vector2 => ({ x: roofCenter.x + along.x * s + across.x * t, y: roofCenter.y + along.y * s + across.y * t });
  if (building.kind === "hangar") {
    graphics.lineStyle(Math.max(1, unit * 0.0012), palette.shadow, 0.22);
    for (let s = -building.width / 2 + building.width / 7; s < building.width / 2; s += building.width / 7) {
      const a = at(s, -building.height * 0.46), b = at(s, building.height * 0.46);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
  } else {
    if (building.kind === "terminal") {
      graphics.fillStyle(0x7f979c, 0.9);
      tracePolygon(graphics, rotatedRectangle(at(0, building.height * 0.28), building.width * 0.86, building.height * 0.16, building.angle));
      graphics.fillPath();
    }
    // Rooftop plant: small boxes with their own short shadows.
    const box = Math.max(2, unit * 0.007);
    for (const s of building.kind === "terminal" ? [-0.28, 0, 0.28] : [-0.15, 0.2]) {
      const spot = at(s * building.width, -building.height * 0.12);
      graphics.fillStyle(palette.shadow, 0.25);
      graphics.fillRect(spot.x - box / 2 + box * 0.4, spot.y - box / 2 + box * 0.3, box, box);
      graphics.fillStyle(mixColor(palette.building, palette.shadow, 0.15), 1);
      graphics.fillRect(spot.x - box / 2, spot.y - box / 2, box, box);
    }
  }
}

/** A tree crown lit from the north-west, with a longer shadow to the south-east. */
export function paintShadedTree(
  graphics: Phaser.GameObjects.Graphics,
  center: Vector2,
  radius: number,
  palette: CivilMapPalette,
  index: number,
): void {
  graphics.fillStyle(palette.shadow, 0.28);
  graphics.fillCircle(center.x + radius * 0.6, center.y + radius * 0.5, radius * 0.95);
  const crown = index % 3 === 0 ? palette.vegetationLight : palette.vegetation;
  graphics.fillStyle(mixColor(crown, palette.shadow, 0.3), 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(crown, 1);
  graphics.fillCircle(center.x - radius * 0.18, center.y - radius * 0.18, radius * 0.78);
  graphics.fillStyle(mixColor(crown, 0xffffff, 0.25), 0.8);
  graphics.fillCircle(center.x - radius * 0.38, center.y - radius * 0.38, radius * 0.38);
}

export function paintTree(
  graphics: Phaser.GameObjects.Graphics,
  center: Vector2,
  radius: number,
  palette: CivilMapPalette,
  index: number,
): void {
  graphics.fillStyle(palette.shadow, 0.2);
  graphics.fillCircle(
    center.x + radius * 0.28,
    center.y + radius * 0.38,
    radius * 0.9,
  );
  graphics.fillStyle(
    index % 3 === 0 ? palette.vegetationLight : palette.vegetation,
    0.72,
  );
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillCircle(
    center.x - radius * 0.5,
    center.y + radius * 0.22,
    radius * 0.62,
  );
  graphics.fillCircle(
    center.x + radius * 0.48,
    center.y + radius * 0.18,
    radius * 0.56,
  );
}
