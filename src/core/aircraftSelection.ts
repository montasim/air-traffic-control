import { AIRCRAFT_OUTLINES } from './aircraftCollision';
import type { AircraftType } from './types';

/** A selection target includes the solid silhouette plus a screen-space margin.
 * It never changes collision geometry. The circular boundary is rotation invariant. */
export function aircraftSelectionRadius(
  type: AircraftType,
  presentationScale: number,
  displayScale: number,
  coarse: boolean,
): number {
  const cssScale = Math.max(Number.EPSILON, displayScale);
  const reach = Math.max(...AIRCRAFT_OUTLINES[type].map(([x, y]) => Math.hypot(x, y))) * presentationScale;
  return Math.max(coarse ? 22 / cssScale : 0, reach + (coarse ? 8 : 3) / cssScale);
}
