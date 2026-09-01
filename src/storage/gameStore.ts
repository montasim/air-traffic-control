import {
  DEFAULT_MAP_ID,
  type MapId
} from '../game/maps/mapIds';
import {
  evaluateEarnedRank,
  isMapUnlocked,
  rankIndex,
  type CareerOrientation,
  type RankId
} from '../progression/ranks';
import {
  cloneGameSave,
  createDefaultGameSave,
  migrateGameSave,
  type AudioSettings,
  type GameSaveV2
} from './gameSave';
import {
  IndexedDbSavePersistence,
  type SavePersistence
} from './persistence';

export interface CompletedShift {
  readonly mapId: MapId;
  readonly orientation: CareerOrientation;
  /** Shift score may diverge from landing count as bonuses are introduced. */
  readonly score: number;
  readonly safeLandings: number;
}

export interface CompletedShiftResult {
  readonly save: GameSaveV2;
  readonly previousRankId: RankId;
  readonly earnedRankId: RankId;
  readonly promoted: boolean;
}

export interface GameStore {
  load(): Promise<GameSaveV2>;
  recordShift(shift: CompletedShift): Promise<CompletedShiftResult>;
  selectMap(mapId: MapId): Promise<GameSaveV2>;
  updateAudio(settings: Partial<AudioSettings>): Promise<GameSaveV2>;
  acknowledgeEarnedRank(): Promise<GameSaveV2>;
}

export class MapLockedError extends Error {
  readonly mapId: MapId;

  constructor(mapId: MapId) {
    super(`Map is locked: ${mapId}`);
    this.name = 'MapLockedError';
    this.mapId = mapId;
  }
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a finite non-negative number`);
  }
  return Math.floor(value);
}

function normalizedVolume(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Audio volume must be finite');
  return Math.min(1, Math.max(0, value));
}

class SerialGameStore implements GameStore {
  private snapshot?: GameSaveV2;
  private loading?: Promise<GameSaveV2>;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly persistence: SavePersistence) {}

  async load(): Promise<GameSaveV2> {
    await this.updateQueue;
    return cloneGameSave(await this.ensureLoaded());
  }

  recordShift(shift: CompletedShift): Promise<CompletedShiftResult> {
    return this.enqueue(async (current) => {
      if (!isMapUnlocked(shift.mapId, current.career.earnedRankId)) {
        throw new MapLockedError(shift.mapId);
      }

      const score = nonNegativeInteger(shift.score, 'Shift score');
      const safeLandings = nonNegativeInteger(shift.safeLandings, 'Safe landings');
      const previousMapRecord = current.mapRecords[shift.mapId];
      const nextMapRecord = {
        bestScores: {
          ...previousMapRecord.bestScores,
          [shift.orientation]: Math.max(previousMapRecord.bestScores[shift.orientation], score)
        },
        safeLandings: previousMapRecord.safeLandings + safeLandings,
        shiftsPlayed: previousMapRecord.shiftsPlayed + 1
      };
      const mapRecords = {
        ...current.mapRecords,
        [shift.mapId]: nextMapRecord
      };
      const totals = {
        totalSafeLandings: current.career.totalSafeLandings + safeLandings,
        shiftsPlayed: current.career.shiftsPlayed + 1
      };
      const evaluatedRankId = evaluateEarnedRank(totals, mapRecords);
      const earnedRankId = rankIndex(evaluatedRankId) >= rankIndex(current.career.earnedRankId)
        ? evaluatedRankId
        : current.career.earnedRankId;
      const next: GameSaveV2 = {
        ...current,
        career: {
          ...current.career,
          ...totals,
          earnedRankId
        },
        mapRecords
      };
      return {
        save: next,
        result: {
          previousRankId: current.career.earnedRankId,
          earnedRankId,
          promoted: earnedRankId !== current.career.earnedRankId
        }
      };
    }).then(({ save, result }) => ({
      save,
      ...result
    }));
  }

  selectMap(mapId: MapId): Promise<GameSaveV2> {
    return this.enqueue(async (current) => {
      if (!isMapUnlocked(mapId, current.career.earnedRankId)) {
        throw new MapLockedError(mapId);
      }
      return {
        save: current.selectedMapId === mapId
          ? current
          : { ...current, selectedMapId: mapId },
        result: undefined
      };
    }).then(({ save }) => save);
  }

  updateAudio(settings: Partial<AudioSettings>): Promise<GameSaveV2> {
    return this.enqueue(async (current) => {
      const audio: AudioSettings = {
        enabled: settings.enabled ?? current.settings.audio.enabled,
        volume: settings.volume === undefined
          ? current.settings.audio.volume
          : normalizedVolume(settings.volume)
      };
      return {
        save: {
          ...current,
          settings: { ...current.settings, audio }
        },
        result: undefined
      };
    }).then(({ save }) => save);
  }

  acknowledgeEarnedRank(): Promise<GameSaveV2> {
    return this.enqueue(async (current) => ({
      save: current.career.acknowledgedRankId === current.career.earnedRankId
        ? current
        : {
            ...current,
            career: {
              ...current.career,
              acknowledgedRankId: current.career.earnedRankId
            }
          },
      result: undefined
    })).then(({ save }) => save);
  }

  private async ensureLoaded(): Promise<GameSaveV2> {
    if (this.snapshot) return this.snapshot;
    if (!this.loading) {
      this.loading = this.persistence.read()
        .then(migrateGameSave)
        .catch(() => createDefaultGameSave())
        .then((save) => {
          this.snapshot = save;
          return save;
        });
    }
    return this.loading;
  }

  private enqueue<Result>(
    update: (current: GameSaveV2) => Promise<{
      readonly save: GameSaveV2;
      readonly result: Result;
    }>
  ): Promise<{ readonly save: GameSaveV2; readonly result: Result }> {
    const operation = this.updateQueue.then(async () => {
      const current = await this.ensureLoaded();
      const { save, result } = await update(current);
      const next = cloneGameSave(save);
      this.snapshot = next;
      try {
        await this.persistence.write(next);
      } catch {
        // The in-memory snapshot remains authoritative for this session.
      }
      return {
        save: cloneGameSave(next),
        result
      };
    });

    this.updateQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }
}

export function createGameStore(persistence: SavePersistence): GameStore {
  return new SerialGameStore(persistence);
}

const defaultStore = createGameStore(new IndexedDbSavePersistence());

export function loadCareerSave(): Promise<GameSaveV2> {
  return defaultStore.load();
}

export function saveCompletedShift(shift: CompletedShift): Promise<CompletedShiftResult> {
  return defaultStore.recordShift(shift);
}

export function setSelectedMap(mapId: MapId): Promise<GameSaveV2> {
  return defaultStore.selectMap(mapId);
}

export function updateAudioSettings(settings: Partial<AudioSettings>): Promise<GameSaveV2> {
  return defaultStore.updateAudio(settings);
}

export function acknowledgeEarnedRank(): Promise<GameSaveV2> {
  return defaultStore.acknowledgeEarnedRank();
}

/**
 * Transitional view used by the current single-map main module. New integration
 * should consume GameSaveV2 through loadCareerSave and saveCompletedShift.
 */
export interface GameSave extends GameSaveV2 {
  readonly bestScore: number;
  readonly bestScores: Readonly<Record<CareerOrientation, number>>;
  readonly totalLandings: number;
  readonly shiftsPlayed: number;
  readonly soundEnabled: boolean;
}

function compatibilityView(save: GameSaveV2): GameSave {
  const currentRecord = save.mapRecords[save.selectedMapId];
  return {
    ...save,
    bestScore: Math.max(currentRecord.bestScores.portrait, currentRecord.bestScores.landscape),
    bestScores: { ...currentRecord.bestScores },
    totalLandings: save.career.totalSafeLandings,
    shiftsPlayed: save.career.shiftsPlayed,
    soundEnabled: save.settings.audio.enabled
  };
}

export async function loadGameSave(): Promise<GameSave> {
  return compatibilityView(await defaultStore.load());
}

export async function recordCompletedShift(
  score: number,
  orientation: CareerOrientation = 'portrait'
): Promise<GameSave> {
  const result = await defaultStore.recordShift({
    mapId: DEFAULT_MAP_ID,
    orientation,
    score,
    safeLandings: score
  });
  return compatibilityView(result.save);
}

export type {
  AudioSettings,
  CareerState,
  GameSaveV2,
  GameSettings,
  MapRecord,
  MapRecords
} from './gameSave';
export {
  DEFAULT_AUDIO_VOLUME,
  SAVE_SCHEMA_VERSION,
  cloneGameSave,
  createDefaultGameSave,
  createEmptyMapRecords,
  migrateGameSave
} from './gameSave';
export {
  IndexedDbSavePersistence,
  MemorySavePersistence,
  type SavePersistence
} from './persistence';
