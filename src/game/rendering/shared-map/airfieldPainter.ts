import { AIRCRAFT_COLORS } from "../../palette";
import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import type {
  MapHelipad,
  MapRunway,
  MapTaxiway,
} from "../../maps/shared/airfield";
import {
  localRunwayPoint,
  rotatedRectangle,
  strokePolyline,
  tracePolygon,
} from "./geometry";
import type { CivilMapPalette } from "./types";

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
  let center = { ...building.center };
  for (const runway of runways) {
    const dx = center.x - runway.center.x,
      dy = center.y - runway.center.y;
    const along = dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle);
    const across = -dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle);
    const clearance =
      runway.width * 0.65 + Math.hypot(building.width, building.height) * 0.5;
    if (Math.abs(along) < runway.length * 0.5 && Math.abs(across) < clearance) {
      const move = (across < 0 ? -1 : 1) * clearance - across;
      center = {
        x: center.x - Math.sin(runway.angle) * move,
        y: center.y + Math.cos(runway.angle) * move,
      };
    }
  }
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
