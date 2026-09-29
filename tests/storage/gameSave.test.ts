import { describe, expect, it } from 'vitest';
import { MAP_IDS } from '../../src/game/maps/mapIds';
import {
  DEFAULT_AUDIO_VOLUME,
  createDefaultGameSave,
  migrateGameSave
} from '../../src/storage/gameSave';

describe('game save migration', () => {
  it('creates a complete normalized v2 save for a new player', () => {
    const save = migrateGameSave(undefined);

    expect(save).toEqual(createDefaultGameSave());
    expect(Object.keys(save.mapRecords)).toEqual(MAP_IDS);
    expect(save.selectedMapId).toBe('saltmarsh-gateway');
  });

  it('preserves v1 Saltmarsh scores, totals, and sound preference', () => {
    const save = migrateGameSave({
      schemaVersion: 1,
      bestScore: 9,
      bestScores: { portrait: 7, landscape: 6 },
      totalLandings: 30,
      shiftsPlayed: 5,
      soundEnabled: false
    });

    expect(save.schemaVersion).toBe(3);
    expect(save.mapRecords['saltmarsh-gateway']).toMatchObject({
      bestScores: { portrait: 7, landscape: 6 },
      safeLandings: 30,
      shiftsPlayed: 5
    });
    expect(save.career.totalSafeLandings).toBe(30);
    expect(save.career.shiftsPlayed).toBe(5);
    expect(save.settings.audio).toEqual({
      enabled: false,
      volume: DEFAULT_AUDIO_VOLUME
    });
  });

  it('uses the legacy global best as the portrait fallback for older v1 saves', () => {
    const save = migrateGameSave({
      schemaVersion: 1,
      bestScore: 12,
      totalLandings: 12,
      shiftsPlayed: 3,
      soundEnabled: true
    });

    expect(save.mapRecords['saltmarsh-gateway'].bestScores).toEqual({
      portrait: 12,
      landscape: 0
    });
  });

  it('acknowledges the rank earned by migrated history to suppress old promotions', () => {
    const save = migrateGameSave({
      schemaVersion: 1,
      bestScore: 10,
      bestScores: { portrait: 10, landscape: 10 },
      totalLandings: 100,
      shiftsPlayed: 25,
      soundEnabled: true
    });

    expect(save.career.earnedRankId).toBe('control-assistant');
    expect(save.career.acknowledgedRankId).toBe(save.career.earnedRankId);
  });

  it('normalizes a partial v2 save without discarding stronger aggregate totals', () => {
    const save = migrateGameSave({
      schemaVersion: 2,
      selectedMapId: 'river-bend',
      settings: { audio: { enabled: false, volume: 4 } },
      career: {
        totalSafeLandings: 20,
        shiftsPlayed: 4,
        earnedRankId: 'control-assistant',
        acknowledgedRankId: 'chief-controller'
      },
      mapRecords: {
        'river-bend': {
          bestScores: { portrait: 8.9, landscape: -2 },
          safeLandings: 7,
          shiftsPlayed: 2
        }
      }
    });

    expect(save.selectedMapId).toBe('river-bend');
    expect(save.settings.audio.volume).toBe(1);
    expect(save.career.totalSafeLandings).toBe(20);
    expect(save.career.shiftsPlayed).toBe(4);
    expect(save.career.acknowledgedRankId).toBe('control-assistant');
    expect(save.mapRecords['river-bend']).toMatchObject({
      bestScores: { portrait: 8, landscape: 0 },
      safeLandings: 7,
      shiftsPlayed: 2
    });
    expect(save.mapRecords['twin-banks']).toMatchObject({
      bestScores: { portrait: 0, landscape: 0 },
      safeLandings: 0,
      shiftsPlayed: 0
    });
  });

  it('does not accept unrelated or future schemas as save data', () => {
    expect(migrateGameSave({ schemaVersion: 99, totalLandings: 500 }))
      .toEqual(createDefaultGameSave());
    expect(migrateGameSave('invalid')).toEqual(createDefaultGameSave());
  });
});
