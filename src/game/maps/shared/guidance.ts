import type { Vector2 } from '../../../core/types';
import type { AirfieldLayout } from './airfield';

export interface RunwayGuidanceSurface {
  readonly kind: 'runway';
  readonly runwayId?: string;
  readonly designators?: readonly [string, string];
  readonly zoneId: string;
  readonly center: Vector2;
  readonly angle: number;
  readonly length: number;
  readonly width: number;
}

export interface PadGuidanceSurface {
  readonly kind: 'pad';
  readonly zoneId: string;
  readonly center: Vector2;
  readonly angle: number;
  readonly radius: number;
}

export type GuidanceSurface = RunwayGuidanceSurface | PadGuidanceSurface;

/** Resolves guidance geometry once with the rest of a responsive layout. */
export function createAirfieldGuidanceSurfaces(
  airfield: Pick<AirfieldLayout, 'runways' | 'helipad'>
): GuidanceSurface[] {
  const surfaces: GuidanceSurface[] = airfield.runways.map((runway) => ({
    kind: 'runway',
    runwayId: runway.id,
    designators: runway.designators,
    zoneId: runway.zoneId,
    center: runway.center,
    angle: runway.angle,
    length: runway.length,
    width: runway.width
  }));

  if (airfield.helipad) {
    surfaces.push({
      kind: 'pad',
      zoneId: airfield.helipad.zoneId,
      center: airfield.helipad.center,
      angle: 0,
      radius: airfield.helipad.radius
    });
  }

  return surfaces;
}

