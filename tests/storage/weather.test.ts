import { expect, it } from 'vitest';
import { createDefaultGameSave, migrateGameSave } from '../../src/storage/gameSave';
import { createGameStore } from '../../src/storage/gameStore';
import { MemorySavePersistence } from '../../src/storage/persistence';

it('defaults on for fresh and older saves, and only an explicit false turns it off', () => {
  expect(createDefaultGameSave().settings.weather).toBe(true);
  for (const schemaVersion of [1, 2, 3]) expect(migrateGameSave({ schemaVersion, settings: {} }).settings.weather).toBe(true);
  for (const value of [undefined, null, 'false', 0, {}, true, false]) {
    const save = createDefaultGameSave();
    expect(migrateGameSave({ ...save, settings: { ...save.settings, weather: value } }).settings.weather).toBe(value !== false);
  }
});

it('keeps the setting through reloads', async () => {
  const persistence = new MemorySavePersistence();
  await createGameStore(persistence).setWeather(false);
  expect((await createGameStore(persistence).load()).settings.weather).toBe(false);
  await createGameStore(persistence).setWeather(true);
  expect((await createGameStore(persistence).load()).settings.weather).toBe(true);
});
