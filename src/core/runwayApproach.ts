import type { Aircraft, LandingZone, Vector2 } from './types';

/** Normal proximity landing, including a capture area crossed between steps. */
export function crossesCapture(previous: Vector2, plane: Aircraft, zone: LandingZone): boolean {
  const dx = plane.position.x - previous.x, dy = plane.position.y - previous.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1,
    ((zone.position.x - previous.x) * dx + (zone.position.y - previous.y) * dy) / length)) : 0;
  return Math.hypot(previous.x + t * dx - zone.position.x, previous.y + t * dy - zone.position.y) <= zone.captureRadius;
}
