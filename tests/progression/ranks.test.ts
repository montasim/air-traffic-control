import { describe, expect, it } from 'vitest';
import { MAP_IDS, type MapId } from '../../src/game/maps/mapIds';
import {
  RANK_CATALOG,
  RANK_IDS,
  evaluateEarnedRank,
  isMapUnlocked,
  promotionProgress,
  unlockedMapIds,
  type CareerPerformanceRecord,
  type CareerPerformanceRecords
} from '../../src/progression/ranks';

function recordsWith(
  scores: Partial<Record<MapId, readonly [portrait: number, landscape: number]>> = {}
): CareerPerformanceRecords {
  return Object.fromEntries(MAP_IDS.map((mapId) => {
    const [portrait, landscape] = scores[mapId] ?? [0, 0];
    const record: CareerPerformanceRecord = {
      bestScores: { portrait, landscape }
    };
    return [mapId, record];
  })) as Record<MapId, CareerPerformanceRecord>;
}

describe('career ranks', () => {
  it('keeps the public rank identity and display order stable', () => {
    expect(RANK_IDS).toEqual([
      'control-trainee',
      'control-assistant',
      'tower-controller',
      'approach-controller',
      'area-controller',
      'senior-controller',
      'chief-controller'
    ]);
    expect(RANK_CATALOG.map(({ name }) => name)).toEqual([
      'Control Trainee',
      'Control Assistant',
      'Tower Controller',
      'Approach Controller',
      'Area Controller',
      'Senior Controller',
      'Chief Controller'
    ]);
  });

  it('uses the better orientation once for each distinct map', () => {
    const records = recordsWith({
      'saltmarsh-gateway': [7, 1],
      'river-bend': [2, 6],
      'desert-parallel': [5, 5]
    });

    expect(promotionProgress(
      { totalSafeLandings: 30, shiftsPlayed: 8 },
      records,
      5
    )).toEqual({
      totalSafeLandings: 30,
      shiftsPlayed: 8,
      qualifyingBestScore: 5,
      distinctMaps: 3
    });
  });

  it('does not substitute repeated performance on one map for distinct-map competence', () => {
    const oneStrongMap = recordsWith({
      'saltmarsh-gateway': [30, 30]
    });
    expect(evaluateEarnedRank(
      { totalSafeLandings: 500, shiftsPlayed: 100 },
      oneStrongMap
    )).toBe('control-assistant');
  });

  it('evaluates all configured career requirements in catalog order', () => {
    const broadPerformance = recordsWith({
      'saltmarsh-gateway': [20, 0],
      'river-bend': [0, 20],
      'desert-parallel': [20, 0],
      'twin-banks': [0, 20]
    });

    expect(evaluateEarnedRank(
      { totalSafeLandings: 149, shiftsPlayed: 40 },
      broadPerformance
    )).toBe('area-controller');
    expect(evaluateEarnedRank(
      { totalSafeLandings: 240, shiftsPlayed: 40 },
      broadPerformance
    )).toBe('chief-controller');
  });

  it('derives cumulative map unlocks from rank definitions', () => {
    expect(unlockedMapIds('control-trainee')).toEqual([
      'saltmarsh-gateway',
      'river-bend'
    ]);
    expect(isMapUnlocked('desert-parallel', 'control-trainee')).toBe(false);
    expect(unlockedMapIds('control-assistant')).toEqual([
      'saltmarsh-gateway',
      'river-bend',
      'desert-parallel'
    ]);
    expect(isMapUnlocked('twin-banks', 'tower-controller')).toBe(true);
  });
});
