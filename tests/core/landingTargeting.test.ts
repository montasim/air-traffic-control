import { describe, expect, it } from 'vitest';
import {
  landingTargetRadius,
  resolveLandingTarget
} from '../../src/core/landingTargeting';
import type { LandingZone } from '../../src/core/types';

const ZONES: LandingZone[] = [
  {
    id: 'rotor-pad',
    label: 'H',
    accepts: 'rotor',
    position: { x: 500, y: 500 },
    angle: 0,
    captureRadius: 40,
    color: 0xffffff
  },
  {
    id: 'commuter-runway',
    label: 'C',
    accepts: 'commuter',
    position: { x: 700, y: 500 },
    angle: 0,
    captureRadius: 36,
    color: 0xffffff
  }
];

describe('landing targeting', () => {
  it('uses capture or collision size and expands coarse targeting', () => {
    const zone = ZONES[0];
    expect(landingTargetRadius(zone, 12, 'mouse')).toBe(56);
    expect(landingTargetRadius(zone, 20, 'mouse')).toBe(70);
    expect(landingTargetRadius(zone, 20, 'coarse')).toBe(82.5);
  });

  it('locks only the nearest compatible zone and snaps to its exact center', () => {
    const result = resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 0, y: 0 }, { x: 535, y: 500 }],
      zones: ZONES,
      pointerPrecision: 'mouse'
    });

    expect(result).toEqual({
      status: 'locked',
      zoneId: 'rotor-pad',
      snappedPoint: { x: 500, y: 500 },
      acquisitionRadius: 56,
      retentionRadius: 70
    });
  });

  it('retains a lock beyond the acquisition radius but releases after hysteresis', () => {
    const retained = resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 565, y: 500 }],
      zones: ZONES,
      pointerPrecision: 'mouse',
      retainedZoneId: 'rotor-pad'
    });
    expect(retained.status).toBe('locked');

    const released = resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 530, y: 500 }, { x: 571, y: 500 }],
      zones: ZONES,
      pointerPrecision: 'mouse',
      retainedZoneId: 'rotor-pad'
    });
    expect(released).toEqual({ status: 'neutral' });
  });

  it('locks when the trailing segment crosses a compatible zone', () => {
    const result = resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 400, y: 500 }, { x: 600, y: 500 }],
      zones: ZONES,
      pointerPrecision: 'mouse'
    });

    expect(result.status).toBe('locked');
    if (result.status === 'locked') expect(result.zoneId).toBe('rotor-pad');
  });

  it('marks an incompatible crossed zone invalid', () => {
    const result = resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 630, y: 500 }, { x: 770, y: 500 }],
      zones: ZONES,
      pointerPrecision: 'coarse'
    });

    expect(result).toEqual({
      status: 'invalid',
      zoneId: 'commuter-runway',
      acquisitionRadius: 66
    });
  });

  it('stays neutral when the route is outside every target', () => {
    expect(resolveLandingTarget({
      aircraftType: 'rotor',
      aircraftCollisionRadius: 16,
      points: [{ x: 30, y: 30 }, { x: 100, y: 100 }],
      zones: ZONES,
      pointerPrecision: 'mouse'
    })).toEqual({ status: 'neutral' });
  });
});
