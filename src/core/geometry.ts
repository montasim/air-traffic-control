import type { Vector2 } from './types';

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function simplifyPoints(points: readonly Vector2[], minimumDistance = 12): Vector2[] {
  if (points.length <= 2) return points.map(({ x, y }) => ({ x, y }));

  const result: Vector2[] = [{ ...points[0] }];
  for (let index = 1; index < points.length - 1; index += 1) {
    if (distance(result[result.length - 1], points[index]) >= minimumDistance) {
      result.push({ ...points[index] });
    }
  }
  result.push({ ...points[points.length - 1] });
  return result;
}

export function smoothPath(points: readonly Vector2[], passes = 2): Vector2[] {
  if (points.length < 3) return points.map(({ x, y }) => ({ x, y }));

  let result = points.map(({ x, y }) => ({ x, y }));
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Vector2[] = [{ ...result[0] }];
    for (let index = 0; index < result.length - 1; index += 1) {
      const current = result[index];
      const following = result[index + 1];
      next.push({ x: lerp(current.x, following.x, 0.25), y: lerp(current.y, following.y, 0.25) });
      next.push({ x: lerp(current.x, following.x, 0.75), y: lerp(current.y, following.y, 0.75) });
    }
    next.push({ ...result[result.length - 1] });
    result = next;
  }
  return result;
}
