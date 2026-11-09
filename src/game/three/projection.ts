import type { Vector2 } from '../../core/types';

/** Cap color-buffer memory independently of CSS fitting or device pixel ratio. */
export function drawingSize(world: Vector2 | { width: number; height: number }, maxPixels = 500_000) {
  const width = 'width' in world ? world.width : world.x;
  const height = 'height' in world ? world.height : world.y;
  if (!(width > 0 && height > 0 && maxPixels >= 1) || !Number.isFinite(width + height + maxPixels)) throw new RangeError('Invalid canvas bounds');
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function pointerToWorld(point: Vector2, rect: { left: number; top: number; width: number; height: number }, world: { width: number; height: number }): Vector2 {
  return { x: (point.x - rect.left) * world.width / Math.max(1, rect.width),
    y: (point.y - rect.top) * world.height / Math.max(1, rect.height) };
}
