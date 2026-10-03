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


/**
 * Where a building is actually drawn: one overlapping a runway is pushed
 * sideways until it clears. Ground routes use the same rule to avoid it.
 */
export function buildingCenterClearOfRunways(
  buildingCenter: Vector2,
  width: number,
  height: number,
  runways: readonly { readonly center: Vector2; readonly length: number; readonly width: number; readonly angle: number }[],
): Vector2 {
  let center = { ...buildingCenter };
  for (const runway of runways) {
    const dx = center.x - runway.center.x,
      dy = center.y - runway.center.y;
    const along = dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle);
    const across = -dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle);
    const clearance = runway.width * 0.65 + Math.hypot(width, height) * 0.5;
    if (Math.abs(along) < runway.length * 0.5 && Math.abs(across) < clearance) {
      const move = (across < 0 ? -1 : 1) * clearance - across;
      center = {
        x: center.x - Math.sin(runway.angle) * move,
        y: center.y + Math.cos(runway.angle) * move,
      };
    }
  }
  return center;
}

const filletDistance = (a: Vector2, b: Vector2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Turns sharper than this are reversals, done as a stop and pivot rather than a curve. */
export const PIVOT_TURN = (100 * Math.PI) / 180;

function turnAngle(previous: Vector2, corner: Vector2, next: Vector2): number {
  const a = Math.atan2(corner.y - previous.y, corner.x - previous.x);
  const b = Math.atan2(next.y - corner.y, next.x - corner.x);
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
}

/** Round each ordinary corner into a short curve; reversals stay sharp for the pivot. */
export function filletCorners(points: readonly Vector2[], radius: number): Vector2[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));
  const result: Vector2[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [previous, corner, next] = [points[i - 1], points[i], points[i + 1]];
    const turn = turnAngle(previous, corner, next);
    if (turn < 0.05 || turn >= PIVOT_TURN) {
      result.push({ ...corner });
      continue;
    }
    const r = Math.min(radius, filletDistance(previous, corner) * 0.45, filletDistance(corner, next) * 0.45);
    const entry = { x: corner.x + (previous.x - corner.x) * (r / filletDistance(previous, corner)), y: corner.y + (previous.y - corner.y) * (r / filletDistance(previous, corner)) };
    const exit = { x: corner.x + (next.x - corner.x) * (r / filletDistance(corner, next)), y: corner.y + (next.y - corner.y) * (r / filletDistance(corner, next)) };
    // Quadratic curve through the corner; six samples read as smooth at taxi speed.
    for (let step = 0; step <= 6; step += 1) {
      const t = step / 6;
      const u = 1 - t;
      result.push({
        x: u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y,
      });
    }
  }
  result.push({ ...points[points.length - 1] });
  return result.filter((point, index) => index === 0 || filletDistance(point, result[index - 1]) > 0.01);
}
