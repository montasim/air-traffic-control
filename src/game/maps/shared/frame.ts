import type { Vector2 } from '../../../core/types';
import type { MapLayoutVariant } from '../types';

/**
 * A map composed once in a landscape design frame — positions as offsets from
 * the screen centre in units of the shorter side — placed on any viewport.
 * Portrait turns the composition a quarter turn so its long axis runs down the
 * screen; squarer screens scale it down until its widest reach fits.
 */
export interface MapFrame {
  readonly unit: number;
  readonly variant: MapLayoutVariant;
  /** Design scale applied to positions and lengths (1 on wide screens). */
  readonly scale: number;
  point(x: number, y: number): Vector2;
  angle(designAngle: number): number;
  /** A length that shrinks with the composition (runways, aprons). */
  length(designLength: number): number;
}

export function variantFor(width: number, height: number): MapLayoutVariant {
  const aspect = width / height;
  if (aspect > 1.18) return 'landscape';
  if (aspect < 0.85) return 'portrait';
  return 'square';
}

/**
 * `reach` is how far the composition extends from the centre along its long axis,
 * in units, including room for approaches; `minScale` is how far it may shrink.
 */
export function createMapFrame(width: number, height: number, reach: number, minScale = 0.7): MapFrame {
  const unit = Math.min(width, height);
  const variant = variantFor(width, height);
  const turn = variant === 'portrait' ? Math.PI / 2 : 0;
  const halfLong = Math.max(width, height) / unit / 2;
  const scale = Math.max(minScale, Math.min(1, (halfLong - 0.03) / reach));
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const center = { x: width / 2, y: height / 2 };
  return {
    unit,
    variant,
    scale,
    point: (x, y) => ({
      x: center.x + (x * cos - y * sin) * scale * unit,
      y: center.y + (x * sin + y * cos) * scale * unit,
    }),
    angle: (designAngle) => Math.atan2(Math.sin(designAngle + turn), Math.cos(designAngle + turn)),
    length: (designLength) => designLength * scale * unit,
  };
}

/** Score and best at the top corners, pause at the bottom right, sized like the other maps. */
export function standardHud(width: number, height: number) {
  const edgeX = Math.max(24, width * 0.025);
  const edgeY = Math.max(24, height * 0.02);
  const statWidth = Math.min(220, width * 0.28);
  const statHeight = Math.min(112, height * 0.1);
  const pause = Math.min(112, Math.max(72, Math.min(width, height) * 0.09));
  return [
    { id: 'score', x: 0, y: 0, width: edgeX + statWidth, height: edgeY + statHeight },
    { id: 'best', x: width - edgeX - statWidth, y: 0, width: edgeX + statWidth, height: edgeY + statHeight },
    { id: 'pause', x: width - edgeX - pause, y: height - edgeY - pause, width: edgeX + pause, height: edgeY + pause },
  ];
}
