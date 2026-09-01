import { describe, expect, it } from 'vitest';
import {
  AIRCRAFT_SPEED_SCALE,
  AIRCRAFT_SPEED_VARIANCE,
  aircraftSpeed,
  aircraftTypeAt,
  spawnIntervalAt,
  trafficLimitAt
} from '../../src/core/pacing';
import { DEFAULT_TRAFFIC_PROFILE, resolveTrafficProfile } from '../../src/core/trafficProfile';

describe('pacing', () => {
  it('scales aircraft speeds to 52 percent with three percent variance', () => {
    expect(AIRCRAFT_SPEED_SCALE).toBe(0.52);
    expect(AIRCRAFT_SPEED_VARIANCE).toBe(0.03);
    expect(aircraftSpeed(100, 0)).toBeCloseTo(50.44, 8);
    expect(aircraftSpeed(100, 0.5)).toBeCloseTo(52, 8);
    expect(aircraftSpeed(100, 1)).toBeCloseTo(53.56, 8);
  });

  it('uses the staged spawn interval curve and never drops below 3.5 seconds', () => {
    expect(spawnIntervalAt(0)).toBe(9);
    expect(spawnIntervalAt(89.99)).toBe(9);
    expect(spawnIntervalAt(90)).toBe(7);
    expect(spawnIntervalAt(135)).toBeCloseTo(6.1, 8);
    expect(spawnIntervalAt(180)).toBe(5.2);
    expect(spawnIntervalAt(240)).toBeCloseTo(4.6, 8);
    expect(spawnIntervalAt(300)).toBe(4);
    expect(spawnIntervalAt(360)).toBe(3.5);
    expect(spawnIntervalAt(3_600)).toBe(3.5);
  });

  it('raises traffic capacity gradually to a maximum of ten', () => {
    expect(trafficLimitAt(0)).toBe(3);
    expect(trafficLimitAt(30)).toBe(4);
    expect(trafficLimitAt(60)).toBe(5);
    expect(trafficLimitAt(90)).toBe(6);
    expect(trafficLimitAt(135)).toBe(7);
    expect(trafficLimitAt(180)).toBe(8);
    expect(trafficLimitAt(240)).toBe(9);
    expect(trafficLimitAt(300)).toBe(10);
    expect(trafficLimitAt(3_600)).toBe(10);
  });

  it('evaluates custom staged curves and weighted aircraft selection', () => {
    const profile = resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      aircraftTypeWeights: [
        { type: 'liner', weight: 1 },
        { type: 'rotor', weight: 3 }
      ],
      spawnIntervalStages: [
        { at: 0, interval: 12, transition: 'linear' },
        { at: 60, interval: 6 }
      ],
      trafficLimitStages: [
        { at: 0, limit: 2 },
        { at: 45, limit: 5 }
      ]
    });

    expect(spawnIntervalAt(30, profile)).toBe(9);
    expect(trafficLimitAt(44.99, profile)).toBe(2);
    expect(trafficLimitAt(45, profile)).toBe(5);
    expect(aircraftTypeAt(0.249, profile)).toBe('liner');
    expect(aircraftTypeAt(0.25, profile)).toBe('rotor');
  });
});
