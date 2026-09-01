import type Phaser from 'phaser';
import type { Vector2 } from '../../../core/types';
import type { MapRunway } from '../../maps/shared/airfield';

export function deterministicUnit(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x27d4eb2d) ^ Math.imul(salt + 31, 0x165667b1);
  value ^= value >>> 15;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 0x1_0000_0000;
}

export function tracePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
}

export function strokePolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.strokePath();
}

export function localRunwayPoint(
  runway: Pick<MapRunway, 'center' | 'angle'>,
  along: number,
  across = 0
): Vector2 {
  const forwardX = Math.cos(runway.angle);
  const forwardY = Math.sin(runway.angle);
  return {
    x: runway.center.x + forwardX * along - forwardY * across,
    y: runway.center.y + forwardY * along + forwardX * across
  };
}

export function runwayCorners(
  runway: Pick<MapRunway, 'center' | 'angle' | 'length' | 'width'>,
  lengthPadding = 0,
  widthPadding = 0
): Vector2[] {
  const halfLength = runway.length / 2 + lengthPadding;
  const halfWidth = runway.width / 2 + widthPadding;
  return [
    localRunwayPoint(runway, -halfLength, -halfWidth),
    localRunwayPoint(runway, halfLength, -halfWidth),
    localRunwayPoint(runway, halfLength, halfWidth),
    localRunwayPoint(runway, -halfLength, halfWidth)
  ];
}

export function rotatedRectangle(
  center: Vector2,
  width: number,
  height: number,
  angle: number
): Vector2[] {
  const frame = { center, angle };
  return [
    localRunwayPoint(frame, -width / 2, -height / 2),
    localRunwayPoint(frame, width / 2, -height / 2),
    localRunwayPoint(frame, width / 2, height / 2),
    localRunwayPoint(frame, -width / 2, height / 2)
  ];
}

export function smoothPath(
  points: readonly Vector2[],
  subdivisions: number
): Vector2[] {
  if (points.length < 3) return [...points];
  const result: Vector2[] = [];
  const steps = Math.max(2, Math.floor(subdivisions));

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      result.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
          + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
          + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
          + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
          + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      });
    }
  }
  result.push({ ...points[points.length - 1] });
  return result;
}

