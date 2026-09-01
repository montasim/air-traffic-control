import type { Vector2 } from '../../../core/types';

/** Long, swept wings and a narrow tail make the liner readable by outline. */
export const LINER_SILHOUETTE: readonly Vector2[] = [
  { x: 34, y: 0 },
  { x: 24, y: -5 },
  { x: 7, y: -7 },
  { x: -3, y: -25 },
  { x: -10, y: -25 },
  { x: -7, y: -7 },
  { x: -22, y: -6 },
  { x: -30, y: -14 },
  { x: -34, y: -12 },
  { x: -29, y: 0 },
  { x: -34, y: 12 },
  { x: -30, y: 14 },
  { x: -22, y: 6 },
  { x: -7, y: 7 },
  { x: -10, y: 25 },
  { x: -3, y: 25 },
  { x: 7, y: 7 },
  { x: 24, y: 5 }
];

/** Squarer wings and a blunt cabin distinguish the commuter at small scale. */
export const COMMUTER_SILHOUETTE: readonly Vector2[] = [
  { x: 30, y: 0 },
  { x: 21, y: -7 },
  { x: 5, y: -8 },
  { x: 1, y: -22 },
  { x: -8, y: -22 },
  { x: -8, y: -8 },
  { x: -20, y: -7 },
  { x: -26, y: -13 },
  { x: -30, y: -11 },
  { x: -26, y: 0 },
  { x: -30, y: 11 },
  { x: -26, y: 13 },
  { x: -20, y: 7 },
  { x: -8, y: 8 },
  { x: -8, y: 22 },
  { x: 1, y: 22 },
  { x: 5, y: 8 },
  { x: 21, y: 7 }
];

