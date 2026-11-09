import type { AircraftType } from '../../../core/types';

/** Saltmarsh Gateway's runway widths, shared by every map at the same viewport size. */
export function runwayWidthFor(width: number, height: number, accepts: Exclude<AircraftType, 'rotor'>): number {
  const aspect = width / height;
  const widths = aspect >= 1.18 ? { liner: .054, commuter: .046 }
    : aspect <= .85 ? { liner: .058, commuter: .047 }
    : { liner: .056, commuter: .046 };
  return Math.min(width, height) * widths[accepts];
}
