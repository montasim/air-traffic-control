import { describe, expect, it } from 'vitest';
import {
  MapLockedError,
  createGameStore,
  type GameSaveV2,
  type SavePersistence
} from '../../src/storage/gameStore';
import { MemorySavePersistence } from '../../src/storage/persistence';

class ObservedPersistence implements SavePersistence {
  readonly writes: GameSaveV2[] = [];
  activeWrites = 0;
  maximumActiveWrites = 0;

  async read(): Promise<unknown> {
    return undefined;
  }

  async write(save: GameSaveV2): Promise<void> {
    this.activeWrites += 1;
    this.maximumActiveWrites = Math.max(this.maximumActiveWrites, this.activeWrites);
    await Promise.resolve();
    this.writes.push(save);
    this.activeWrites -= 1;
  }
}

class FailedPersistence implements SavePersistence {
  async read(): Promise<unknown> {
    throw new Error('IndexedDB blocked');
  }

  async write(): Promise<void> {
    throw new Error('IndexedDB blocked');
  }
}

describe('game store', () => {
  it('records score separately from safe landings', async () => {
    const store = createGameStore(new MemorySavePersistence());
    const result = await store.recordShift({
      mapId: 'saltmarsh-gateway',
      orientation: 'portrait',
      score: 25,
      safeLandings: 3
    });

    expect(result.save.mapRecords['saltmarsh-gateway'].bestScores.portrait).toBe(25);
    expect(result.save.mapRecords['saltmarsh-gateway'].safeLandings).toBe(3);
    expect(result.save.career.totalSafeLandings).toBe(3);
    expect(result.save.career.shiftsPlayed).toBe(1);
  });

  it('serializes shift, map, and audio writes without losing concurrent updates', async () => {
    const persistence = new ObservedPersistence();
    const store = createGameStore(persistence);

    await Promise.all([
      store.recordShift({
        mapId: 'saltmarsh-gateway',
        orientation: 'portrait',
        score: 5,
        safeLandings: 2
      }),
      store.updateAudio({ enabled: false, volume: 0.35 }),
      store.selectMap('river-bend'),
      store.recordShift({
        mapId: 'river-bend',
        orientation: 'landscape',
        score: 7,
        safeLandings: 4
      })
    ]);

    const save = await store.load();
    expect(save.career).toMatchObject({
      totalSafeLandings: 6,
      shiftsPlayed: 2
    });
    expect(save.mapRecords['saltmarsh-gateway'].bestScores.portrait).toBe(5);
    expect(save.mapRecords['river-bend'].bestScores.landscape).toBe(7);
    expect(save.selectedMapId).toBe('river-bend');
    expect(save.settings.audio).toEqual({ enabled: false, volume: 0.35 });
    expect(persistence.maximumActiveWrites).toBe(1);
    expect(persistence.writes).toHaveLength(4);
  });

  it('retains a coherent in-memory save when IndexedDB reads and writes fail', async () => {
    const store = createGameStore(new FailedPersistence());

    await store.updateAudio({ enabled: false });
    await store.recordShift({
      mapId: 'saltmarsh-gateway',
      orientation: 'landscape',
      score: 6,
      safeLandings: 4
    });

    const save = await store.load();
    expect(save.settings.audio.enabled).toBe(false);
    expect(save.career.totalSafeLandings).toBe(4);
    expect(save.mapRecords['saltmarsh-gateway'].bestScores.landscape).toBe(6);
  });

  it('promotes from recorded performance and keeps the promotion pending until acknowledged', async () => {
    const store = createGameStore(new MemorySavePersistence());
    await store.recordShift({
      mapId: 'saltmarsh-gateway',
      orientation: 'portrait',
      score: 3,
      safeLandings: 4
    });
    const promotion = await store.recordShift({
      mapId: 'saltmarsh-gateway',
      orientation: 'portrait',
      score: 5,
      safeLandings: 4
    });

    expect(promotion).toMatchObject({
      previousRankId: 'control-trainee',
      earnedRankId: 'control-assistant',
      promoted: true
    });
    expect(promotion.save.career.acknowledgedRankId).toBe('control-trainee');

    const acknowledged = await store.acknowledgeEarnedRank();
    expect(acknowledged.career.acknowledgedRankId).toBe('control-assistant');
  });

  it('rejects locked maps while allowing later queued updates to continue', async () => {
    const store = createGameStore(new MemorySavePersistence());

    await expect(store.selectMap('twin-banks')).rejects.toBeInstanceOf(MapLockedError);
    const save = await store.updateAudio({ volume: 0.2 });

    expect(save.selectedMapId).toBe('saltmarsh-gateway');
    expect(save.settings.audio.volume).toBe(0.2);
  });

  it('returns detached snapshots that callers cannot use to mutate store state', async () => {
    const store = createGameStore(new MemorySavePersistence());
    const first = await store.load();
    const mutable = first as {
      settings: { audio: { enabled: boolean } };
    };
    mutable.settings.audio.enabled = false;

    expect((await store.load()).settings.audio.enabled).toBe(true);
  });
});
