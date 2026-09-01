import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAFFIC_PROFILE, resolveTrafficProfile } from '../../src/core/trafficProfile';

describe('traffic profiles', () => {
  it('encodes the legacy pacing as the default profile', () => {
    expect(DEFAULT_TRAFFIC_PROFILE.openingSpawns).toEqual([
      { at: 0, type: 'commuter' },
      { at: 12, type: 'liner' },
      { at: 24, type: 'rotor' }
    ]);
    expect(DEFAULT_TRAFFIC_PROFILE.speedMultipliers).toEqual({
      liner: 0.52,
      commuter: 0.52,
      rotor: 0.52
    });
    expect(DEFAULT_TRAFFIC_PROFILE.spawnCorridors).toBeUndefined();
  });

  it('sorts stages, normalizes weights, and clamps normalized geometry', () => {
    const profile = resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      openingSpawns: [
        { at: 8, type: 'liner' },
        { at: 0, type: 'rotor' }
      ],
      aircraftTypeWeights: [
        { type: 'liner', weight: 1 },
        { type: 'rotor', weight: 3 },
        { type: 'commuter', weight: 0 }
      ],
      spawnIntervalStages: [
        { at: 20, interval: 5 },
        { at: 0, interval: 10 }
      ],
      trafficLimitStages: [
        { at: 30, limit: 4 },
        { at: 0, limit: 2 }
      ],
      spawnCorridors: [{ edge: 'left', from: 1.4, to: -0.6, weight: 4 }],
      inwardTargetRegion: { minX: 0.8, maxX: -0.2, minY: 0.4, maxY: 4 }
    });

    expect(profile.openingSpawns.map((spawn) => spawn.at)).toEqual([0, 8]);
    expect(profile.aircraftTypeWeights).toEqual([
      { type: 'liner', weight: 0.25 },
      { type: 'rotor', weight: 0.75 }
    ]);
    expect(profile.spawnIntervalStages.map((stage) => stage.at)).toEqual([0, 20]);
    expect(profile.trafficLimitStages.map((stage) => stage.at)).toEqual([0, 30]);
    expect(profile.spawnCorridors).toEqual([{ edge: 'left', from: 0, to: 1, weight: 1 }]);
    expect(profile.inwardTargetRegion).toEqual({
      minX: 0,
      maxX: 0.8,
      minY: 0.4,
      maxY: 1
    });
  });

  it('rejects profiles that cannot schedule traffic safely', () => {
    expect(() => resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      aircraftTypeWeights: [{ type: 'liner', weight: 0 }]
    })).toThrow(/positive weight/);
    expect(() => resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      spawnIntervalStages: [{ at: 4, interval: 8 }]
    })).toThrow(/begin at zero/);
    expect(() => resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      trafficLimitStages: [{ at: 0, limit: 2.5 }]
    })).toThrow(/integers/);
  });
});
