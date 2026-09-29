import { describe, it, expect } from 'vitest';
import { createGameStore, MemorySavePersistence } from '../../src/storage/gameStore';
import { createDefaultGameSave, migrateGameSave, cloneGameSave } from '../../src/storage/gameSave';
import { ACHIEVEMENTS, ShiftTracker, evaluateAchievements } from '../../src/progression/achievements';

const shift = { runId: 'run-1', mapId: 'saltmarsh-gateway' as const, orientation: 'portrait' as const, difficulty: 'hard' as const, score: 10, safeLandings: 10, evidence: { landedTypes: { liner: 4, commuter: 3, rotor: 3 }, initialSafeLandings: 10 } };
describe('difficulty records and achievements', () => {
  it('migrates old records to Medium and only backfills provable badges', () => {
    const save = migrateGameSave({ schemaVersion: 2, mapRecords: { 'saltmarsh-gateway': { bestScores: { portrait: 12, landscape: 4 }, safeLandings: 20, shiftsPlayed: 2 } } });
    expect(save.mapRecords['saltmarsh-gateway'].difficultyScores.medium).toEqual({ portrait: 12, landscape: 4 });
    expect(save.mapRecords['saltmarsh-gateway'].difficultyScores.hard.portrait).toBe(0);
    expect(save.achievements['busy-shift']).toEqual({ earnedAt: null });
    expect(save.achievements['mixed-fleet']).toBeUndefined();
    expect(migrateGameSave(save)).toEqual(save);
  });
  it('records once, separates modes, and awards from real evidence', async () => {
    const store = createGameStore(new MemorySavePersistence());
    const result = await store.recordShift(shift);
    expect(result.newAchievements).toEqual(expect.arrayContaining(['first-landing', 'mixed-fleet', 'steady-hands', 'under-pressure']));
    const repeated = await store.recordShift(shift);
    expect(repeated.newAchievements).toEqual([]);
    expect(repeated.save.career.totalSafeLandings).toBe(10);
    expect(repeated.save.mapRecords[shift.mapId].difficultyScores.medium.portrait).toBe(0);
    const next = await store.recordShift({ ...shift, runId: 'run-2', difficulty: 'easy', score: 12, safeLandings: 12, evidence: undefined });
    expect(next.save.mapRecords[shift.mapId].bestScores.portrait).toBe(12);
    expect(next.save.mapRecords[shift.mapId].difficultyScores.hard.portrait).toBe(10);
  });
  it('retains serialized settings and selection updates', async () => {
    const store = createGameStore(new MemorySavePersistence());
    await Promise.all([store.recordShift(shift), store.updateAudio({ volume: .25 }), store.selectDifficulty('easy')]);
    const save = await store.load();
    expect(save.selectedDifficulty).toBe('easy'); expect(save.settings.audio.volume).toBe(.25); expect(save.career.totalSafeLandings).toBe(10);
    const clone = cloneGameSave(save); clone.mapRecords[shift.mapId].difficultyScores.hard.portrait = 99;
    expect((await store.load()).mapRecords[shift.mapId].difficultyScores.hard.portrait).toBe(10);
  });
  it('stops warning-free progress at first warning and resets for a new shift', () => {
    const tracker = new ShiftTracker();
    tracker.accept({ type: 'landed', aircraftId: 1, aircraftType: 'liner', score: 1 });
    tracker.accept({ type: 'warning', aircraftIds: [2, 3] });
    tracker.accept({ type: 'warning', aircraftIds: [2, 3] });
    tracker.accept({ type: 'landed', aircraftId: 2, aircraftType: 'rotor', score: 2 });
    expect(tracker.evidence.initialSafeLandings).toBe(1);
    expect(tracker.evidence.landedTypes.rotor).toBe(1);
    expect(new ShiftTracker().evidence.initialSafeLandings).toBe(0);
  });
  it('rejects contradictory evidence and reports unavailable persistence', async () => {
    const store = createGameStore({ read: async () => null, write: async () => { throw new Error('Unavailable'); } });
    await expect(store.recordShift({ ...shift, safeLandings: 2 })).rejects.toThrow();
    const result = await store.recordShift(shift);
    expect(result.persisted).toBe(false);
    expect((await store.load()).career.totalSafeLandings).toBe(10);
  });
  it('awards nothing on an empty save', () => { expect(evaluateAchievements(createDefaultGameSave(), 1).newIds).toEqual([]); });
  it('awards all badges at their thresholds and never repeats earned badges', () => {
    const base = createDefaultGameSave();
    const records = base.mapRecords;
    for (const record of Object.values(records)) {
      Object.assign(record, { safeLandings: 25, shiftsPlayed: 3, bestScores: { portrait: 10, landscape: 0 } });
      record.difficultyScores.hard.portrait = 10;
    }
    const qualified = { ...base, mapRecords: records, career: { ...base.career, totalSafeLandings: 100 }, achievementEvidence: { mixedFleetBest: 3, initialSafeBest: 10 } };
    const earned = evaluateAchievements(qualified, 123);
    expect(earned.newIds).toHaveLength(ACHIEVEMENTS.length);
    for (const badge of ACHIEVEMENTS) expect(earned.awards[badge.id]?.earnedAt).toBe(123);
    expect(evaluateAchievements({ ...qualified, achievements: earned.awards }, 456).newIds).toEqual([]);
    const below = { ...qualified, career: { ...qualified.career, totalSafeLandings: 99 }, achievementEvidence: { mixedFleetBest: 2, initialSafeBest: 9 } };
    for (const id of ['mixed-fleet', 'steady-hands', 'veteran-controller']) expect(evaluateAchievements(below, 1).newIds).not.toContain(id);
  });
  it('persists difficulty, scores, and awards through a fresh store load', async () => {
    const persistence = new MemorySavePersistence();
    const store = createGameStore(persistence);
    await store.selectDifficulty('hard'); await store.recordShift(shift);
    const reloaded = await createGameStore(persistence).load();
    expect(reloaded.selectedDifficulty).toBe('hard');
    expect(reloaded.achievements['under-pressure']).toBeDefined();
    expect(reloaded.mapRecords[shift.mapId].difficultyScores.hard.portrait).toBe(10);
  });

});
