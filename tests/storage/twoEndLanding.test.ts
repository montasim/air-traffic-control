import { expect, it } from 'vitest';
import { createDefaultGameSave, migrateGameSave } from '../../src/storage/gameSave';
import { createGameStore } from '../../src/storage/gameStore';
import { MemorySavePersistence } from '../../src/storage/persistence';

it('defaults off for fresh, legacy and malformed saves without losing existing records', () => {
  expect(createDefaultGameSave().settings.twoEndLanding).toBe(false);
  for (const schemaVersion of [1, 2, 3]) {
    const migrated = migrateGameSave({ schemaVersion, bestScore: 12, settings: { audio: { enabled: false, volume: .3 } } });
    expect(migrated.settings.twoEndLanding).toBe(false);
    if (schemaVersion === 1) expect(migrated.mapRecords['saltmarsh-gateway'].bestScores.portrait).toBe(12);
    else expect(migrated.settings.audio).toEqual({ enabled: false, volume: .3 });
  }
  for (const value of [undefined, null, 'true', 1, {}, false, true]) {
    const save = createDefaultGameSave();
    save.mapRecords['saltmarsh-gateway'].difficultyScores.hard.landscape = 17;
    const migrated = migrateGameSave({ ...save, settings: { ...save.settings, twoEndLanding: value } });
    expect(migrated.settings.twoEndLanding).toBe(value === true);
    expect(migrated.mapRecords['saltmarsh-gateway'].difficultyScores.hard.landscape).toBe(17);
  }
});

it('serializes toggles, retains the setting through unrelated writes, reloads, and resets', async () => {
  const persistence = new MemorySavePersistence();
  const store = createGameStore(persistence);
  await Promise.all([store.setTwoEndLanding(true), store.setTwoEndLanding(false), store.setTwoEndLanding(true)]);
  await store.updateAudio({ volume: .2 });
  await store.selectDifficulty('hard');
  await store.selectMap('saltmarsh-gateway');
  await store.recordShift({ mapId: 'saltmarsh-gateway', orientation: 'landscape', score: 3, safeLandings: 3 });
  const reloaded = await createGameStore(persistence).load();
  expect(reloaded.settings).toEqual({ twoEndLanding: true, audio: { enabled: true, volume: .2 } });
  expect(reloaded.selectedDifficulty).toBe('hard');
  expect(reloaded.career.totalSafeLandings).toBe(3);
  await store.setTwoEndLanding(false);
  expect((await createGameStore(persistence).load()).settings.twoEndLanding).toBe(false);
  await persistence.write(createDefaultGameSave());
  expect((await createGameStore(persistence).load()).settings.twoEndLanding).toBe(false);
});

it('retains the selection in memory when persistence fails', async () => {
  const store = createGameStore({ read: async () => undefined, write: async () => { throw new Error('unavailable'); } });
  await store.setTwoEndLanding(true);
  await store.updateAudio({ enabled: false });
  expect((await store.load()).settings.twoEndLanding).toBe(true);
});
