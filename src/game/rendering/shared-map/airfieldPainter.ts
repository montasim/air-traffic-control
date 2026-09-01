import type Phaser from 'phaser';
import type { Vector2 } from '../../../core/types';
import type {
  MapHelipad,
  MapRunway,
  MapTaxiway
} from '../../maps/shared/airfield';
import {
  deterministicUnit,
  localRunwayPoint,
  rotatedRectangle,
  runwayCorners,
  strokePolyline,
  tracePolygon
} from './geometry';
import type { CivilMapPalette } from './types';

export interface MapBuilding {
  readonly id: string;
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly kind: 'terminal' | 'hangar' | 'operations';
}

export function paintFieldPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  palette: CivilMapPalette,
  alternate = false
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
  palette: CivilMapPalette
): void {
  graphics.fillStyle(palette.waterEdge, 0.52);
  tracePolygon(graphics, points);
  graphics.fillPath();
  const center = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 }
  );
  const inset = points.map((point) => ({
    x: point.x + (center.x / points.length - point.x) * 0.12,
    y: point.y + (center.y / points.length - point.y) * 0.12
  }));
  graphics.fillStyle(palette.water, 0.92);
  tracePolygon(graphics, inset);
  graphics.fillPath();
}

export function paintRiver(
  graphics: Phaser.GameObjects.Graphics,
  path: readonly Vector2[],
  width: number,
  palette: CivilMapPalette
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
  palette: CivilMapPalette
): void {
  graphics.fillStyle(palette.airportGround, 0.92);
  tracePolygon(graphics, apron);
  graphics.fillPath();
  graphics.fillStyle(palette.apron, 0.96);
  const center = apron.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  const inset = apron.map((point) => ({
    x: point.x + (center.x / apron.length - point.x) * 0.08,
    y: point.y + (center.y / apron.length - point.y) * 0.08
  }));
  tracePolygon(graphics, inset);
  graphics.fillPath();
}

export function paintTaxiway(
  graphics: Phaser.GameObjects.Graphics,
  taxiway: MapTaxiway,
  palette: CivilMapPalette
): void {
  graphics.lineStyle(taxiway.width * 1.28, palette.asphaltEdge, 0.78);
  strokePolyline(graphics, taxiway.path);
  graphics.lineStyle(taxiway.width, palette.asphalt, 1);
  strokePolyline(graphics, taxiway.path);
  graphics.lineStyle(Math.max(1.1, taxiway.width * 0.055), palette.taxiwayMarking, 0.62);
  strokePolyline(graphics, taxiway.path);
}

export function paintRunway(
  graphics: Phaser.GameObjects.Graphics,
  runway: MapRunway,
  palette: CivilMapPalette,
  wearCount = 12
): void {
  graphics.fillStyle(palette.asphaltEdge, 0.94);
  tracePolygon(graphics, runwayCorners(runway, runway.width * 0.2, runway.width * 0.26));
  graphics.fillPath();
  graphics.fillStyle(palette.asphalt, 1);
  tracePolygon(graphics, runwayCorners(runway));
  graphics.fillPath();

  const halfLength = runway.length / 2;
  const halfWidth = runway.width / 2;
  graphics.lineStyle(Math.max(1.2, runway.width * 0.038), palette.marking, 0.66);
  for (const side of [-1, 1]) {
    const from = localRunwayPoint(runway, -halfLength + runway.width * 0.5, side * halfWidth * 0.82);
    const to = localRunwayPoint(runway, halfLength - runway.width * 0.5, side * halfWidth * 0.82);
    graphics.lineBetween(from.x, from.y, to.x, to.y);
  }

  const dashLength = Math.max(10, runway.length * 0.042);
  const centerLimit = halfLength - runway.width * 1.8;
  graphics.lineStyle(Math.max(1.7, runway.width * 0.055), palette.marking, 0.88);
  for (let along = -centerLimit; along < centerLimit; along += dashLength * 2.35) {
    const from = localRunwayPoint(runway, along);
    const to = localRunwayPoint(runway, Math.min(along + dashLength, centerLimit));
    graphics.lineBetween(from.x, from.y, to.x, to.y);
  }

  const thresholdBars = runway.width >= 42 ? 5 : 4;
  for (const end of [-1, 1]) {
    const along = end * (halfLength - runway.width * 0.58);
    for (let index = 0; index < thresholdBars; index += 1) {
      const across = -halfWidth * 0.62 + (halfWidth * 1.24 * index) / (thresholdBars - 1);
      const from = localRunwayPoint(runway, along, across);
      const to = localRunwayPoint(runway, along - end * runway.width * 0.48, across);
      graphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  graphics.lineStyle(Math.max(1, runway.width * 0.035), palette.terrainDark, 0.3);
  for (let index = 0; index < wearCount; index += 1) {
    const along = (deterministicUnit(index, 43) - 0.5) * runway.length * 0.72;
    const across = (deterministicUnit(index, 67) - 0.5) * runway.width * 0.35;
    const start = localRunwayPoint(runway, along, across);
    const end = localRunwayPoint(runway, along + runway.width * 0.42, across);
    graphics.lineBetween(start.x, start.y, end.x, end.y);
  }
}

export function paintHelipad(
  graphics: Phaser.GameObjects.Graphics,
  helipad: MapHelipad,
  palette: CivilMapPalette
): void {
  graphics.fillStyle(palette.asphaltEdge, 0.94);
  graphics.fillCircle(helipad.center.x, helipad.center.y, helipad.radius * 1.14);
  graphics.fillStyle(palette.apron, 1);
  graphics.fillCircle(helipad.center.x, helipad.center.y, helipad.radius);
  graphics.lineStyle(Math.max(1.5, helipad.radius * 0.08), palette.marking, 0.85);
  graphics.strokeCircle(helipad.center.x, helipad.center.y, helipad.radius * 0.72);
  const h = helipad.radius * 0.38;
  graphics.lineBetween(helipad.center.x - h, helipad.center.y - h, helipad.center.x - h, helipad.center.y + h);
  graphics.lineBetween(helipad.center.x + h, helipad.center.y - h, helipad.center.x + h, helipad.center.y + h);
  graphics.lineBetween(helipad.center.x - h, helipad.center.y, helipad.center.x + h, helipad.center.y);
}

export function paintBuilding(
  graphics: Phaser.GameObjects.Graphics,
  building: MapBuilding,
  palette: CivilMapPalette
): void {
  const points = rotatedRectangle(
    building.center,
    building.width,
    building.height,
    building.angle
  );
  const shadow = points.map((point) => ({ x: point.x + 5, y: point.y + 7 }));
  graphics.fillStyle(palette.shadow, 0.34);
  tracePolygon(graphics, shadow);
  graphics.fillPath();
  graphics.fillStyle(palette.building, 1);
  tracePolygon(graphics, points);
  graphics.fillPath();
  graphics.lineStyle(Math.max(1, Math.min(building.width, building.height) * 0.08), palette.buildingRoof, 0.62);
  graphics.lineBetween(points[0].x, points[0].y, points[1].x, points[1].y);
}

export function paintTree(
  graphics: Phaser.GameObjects.Graphics,
  center: Vector2,
  radius: number,
  palette: CivilMapPalette,
  index: number
): void {
  graphics.fillStyle(palette.shadow, 0.2);
  graphics.fillCircle(center.x + radius * 0.28, center.y + radius * 0.38, radius * 0.9);
  graphics.fillStyle(index % 3 === 0 ? palette.vegetationLight : palette.vegetation, 0.72);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillCircle(center.x - radius * 0.5, center.y + radius * 0.22, radius * 0.62);
  graphics.fillCircle(center.x + radius * 0.48, center.y + radius * 0.18, radius * 0.56);
}

