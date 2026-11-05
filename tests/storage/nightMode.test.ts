import { expect, it } from 'vitest';
import { createDefaultGameSave, migrateGameSave } from '../../src/storage/gameSave';
import { createGameStore } from '../../src/storage/gameStore';
import { MemorySavePersistence } from '../../src/storage/persistence';

it('defaults off for fresh, legacy and malformed saves', () => {
  expect(createDefaultGameSave().settings.night).toBe(false);
  for (const schemaVersion of [1, 2, 3]) expect(migrateGameSave({ schemaVersion, bestScore: 4 }).settings.night).toBe(false);
  for (const value of [undefined, null, 'true', 1, {}, false, true]) {
    const save = createDefaultGameSave();
    expect(migrateGameSave({ ...save, settings: { ...save.settings, night: value } }).settings.night).toBe(value === true);
  }
});

it('persists through unrelated writes and a reload, with an intact seal', async () => {
  const persistence = new MemorySavePersistence();
  const store = createGameStore(persistence);
  await store.setNight(true);
  await store.setTwoEndLanding(true);
  const reloaded = await createGameStore(persistence).load();
  expect(reloaded.settings.night).toBe(true);
  expect(reloaded.modified).toBeUndefined();
  await store.setNight(false);
  expect((await createGameStore(persistence).load()).settings.night).toBe(false);
});
