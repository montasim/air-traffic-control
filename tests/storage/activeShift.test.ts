import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { ShiftTracker } from '../../src/progression/achievements';
import { clearActiveShift, loadActiveShift, saveActiveShift, type ActiveShift } from '../../src/storage/activeShift';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const KEY = 'vector-approach:active-shift';

function sampleShift(): ActiveShift {
  const simulation = new Simulation([]);
  simulation.start(3);
  return {
    version: 1, savedAt: 1, runId: 'run-1', mapId: 'blue-water', difficulty: 'hard', orientation: 'portrait',
    world: { width: 900, height: 1600 }, twoEndLanding: false,
    simulation: simulation.exportState(), tracker: new ShiftTracker().exportState(),
  };
}

describe('active shift storage', () => {
  it('loads back what it saved, including an unscheduled spawn', () => {
    const storage = new MemoryStorage();
    const shift = { ...sampleShift() };
    shift.simulation = { ...shift.simulation, nextSpawnAt: Number.POSITIVE_INFINITY };
    saveActiveShift(shift, storage);
    const loaded = loadActiveShift(storage);
    expect(loaded?.runId).toBe('run-1');
    expect(loaded?.simulation.aircraft).toEqual(JSON.parse(JSON.stringify(shift.simulation.aircraft)));
    clearActiveShift(storage);
    expect(loadActiveShift(storage)).toBeUndefined();
  });

  it('discards and clears unreadable, stale, unknown, or edited shifts', () => {
    const bad: ((shift: Record<string, unknown>) => string)[] = [
      () => '{not json',
      (shift) => JSON.stringify({ ...shift, version: 2 }),
      (shift) => JSON.stringify({ ...shift, mapId: 'atlantis' }),
      (shift) => JSON.stringify({ ...shift, simulation: { ...(shift.simulation as object), aircraft: undefined } }),
      (shift) => JSON.stringify({ ...shift, simulation: { ...(shift.simulation as object), score: 999 } }),
    ];
    for (const corrupt of bad) {
      const storage = new MemoryStorage();
      saveActiveShift(sampleShift(), storage);
      storage.setItem(KEY, corrupt(JSON.parse(storage.getItem(KEY)!)));
      expect(loadActiveShift(storage)).toBeUndefined();
      expect(storage.getItem(KEY)).toBeNull();
    }
  });
});
