import { describe, expect, it } from 'vitest';
import { LIVERIES, isLiveryUnlocked, normalizeLivery, type LiveryId } from '../../src/progression/liveries';
import { createGameStore, MemorySavePersistence } from '../../src/storage/gameStore';
import { createDefaultGameSave, migrateGameSave } from '../../src/storage/gameSave';

describe('optional career liveries', () => {
  it('gates rewards by rank and safely loads old, invalid, or locked selections', () => {
    expect(isLiveryUnlocked('signal', 'control-assistant')).toBe(false);
    expect(isLiveryUnlocked('signal', 'tower-controller')).toBe(true);
    expect(isLiveryUnlocked('midnight', 'area-controller')).toBe(false);
    expect(isLiveryUnlocked('midnight', 'senior-controller')).toBe(true);
    expect(normalizeLivery('unknown', 'air-boss')).toBe('classic');
    const legacy = createDefaultGameSave();
    for (const [oldId, newId] of [['twin-bands', 'signal'], ['chevron', 'midnight']]) {
      const migrated = migrateGameSave({ ...legacy, career: { ...legacy.career, earnedRankId: 'senior-controller' }, settings: { ...legacy.settings, livery: oldId } });
      expect(migrated.settings.livery).toBe(newId);
      expect(normalizeLivery(oldId, 'control-trainee')).toBe('classic');
    }
    const save = createDefaultGameSave();
    for (const livery of [undefined, 'unknown', 'midnight']) {
      expect(migrateGameSave({ ...save, settings: { ...save.settings, livery } }).settings.livery).toBe('classic');
    }
  });

  it('persists the chosen cosmetic without changing career, records, or other settings', async () => {
    const save = createDefaultGameSave();
    const persistence = new MemorySavePersistence({ ...save, career: { ...save.career, earnedRankId: 'senior-controller' } });
    const store = createGameStore(persistence);
    const before = await store.load();
    for (const livery of LIVERIES) {
      const result = await store.selectLivery(livery.id);
      expect(result.persisted).toBe(true);
      expect(await createGameStore(persistence).load()).toEqual({ ...before, settings: { ...before.settings, livery: livery.id } });
    }
    await expect(store.selectLivery('invalid' as LiveryId)).rejects.toThrow('invalid or locked');
    const trainee = createGameStore(new MemorySavePersistence());
    await expect(trainee.selectLivery('signal')).rejects.toThrow('invalid or locked');
    expect((await trainee.load()).settings.livery).toBe('classic');
  });

  it('keeps selection optional after promotion and reports a failed save', async () => {
    const save = createDefaultGameSave();
    const store = createGameStore(new MemorySavePersistence(save));
    await store.recordShift({ mapId: save.selectedMapId, orientation: 'portrait', score: 8, safeLandings: 8 });
    const result = await store.recordShift({ mapId: save.selectedMapId, orientation: 'portrait', score: 8, safeLandings: 8 });
    expect(result.promoted).toBe(true);
    expect(result.save.settings.livery).toBe('classic');
    const failing = createGameStore({ read: async () => save, write: async () => { throw new Error('Disk full'); } });
    expect((await failing.selectLivery('classic')).persisted).toBe(false);
  });
});
