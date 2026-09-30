import { isDifficulty, type DifficultyId } from '../core/difficulty';
import { evaluateAchievements, type AchievementId, type ShiftEvidence } from '../progression/achievements';
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
  type GameSaveV3
} from './gameSave';
import {
  IndexedDbSavePersistence,
  type SavePersistence
} from './persistence';

export interface CompletedShift {
  readonly runId?: string;
  readonly difficulty?: DifficultyId;
  readonly evidence?: ShiftEvidence;
  readonly mapId: MapId;
  readonly orientation: CareerOrientation;
  /** Shift score may diverge from landing count as bonuses are introduced. */
  readonly score: number;
  readonly safeLandings: number;
}

export interface CompletedShiftResult {
  readonly newAchievements: AchievementId[];
  readonly persisted: boolean;
  readonly save: GameSaveV3;
  readonly previousRankId: RankId;
  readonly earnedRankId: RankId;
  readonly promoted: boolean;
}

export interface GameStore {
  load(): Promise<GameSaveV3>;
  recordShift(shift: CompletedShift): Promise<CompletedShiftResult>;
  selectDifficulty(difficulty: DifficultyId): Promise<GameSaveV3>;
  setTwoEndLanding(enabled: boolean): Promise<GameSaveV3>;
  selectMap(mapId: MapId): Promise<GameSaveV3>;
  updateAudio(settings: Partial<AudioSettings>): Promise<GameSaveV3>;
  acknowledgeEarnedRank(): Promise<GameSaveV3>;
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
  private snapshot?: GameSaveV3;
  private loading?: Promise<GameSaveV3>;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly persistence: SavePersistence) {}

  async load(): Promise<GameSaveV3> {
    await this.updateQueue;
    return cloneGameSave(await this.ensureLoaded());
  }

  recordShift(shift: CompletedShift): Promise<CompletedShiftResult> {
    return this.enqueue(async (current) => {
      if (!isMapUnlocked(shift.mapId, current.career.earnedRankId)) {
        throw new MapLockedError(shift.mapId);
      }

      if (shift.runId && current.lastCommittedRunId === shift.runId) return {
        save: current, result: { previousRankId: current.career.earnedRankId, earnedRankId: current.career.earnedRankId, promoted: false, newAchievements: [] as AchievementId[] }
      };
      const difficulty = shift.difficulty ?? 'medium';
      if (!isDifficulty(difficulty)) throw new RangeError('Invalid difficulty');
      const score = nonNegativeInteger(shift.score, 'Shift score');
      const safeLandings = nonNegativeInteger(shift.safeLandings, 'Safe landings');
      const previousMapRecord = current.mapRecords[shift.mapId];
      const nextMapRecord = {
        difficultyScores: {
          ...previousMapRecord.difficultyScores,
          [difficulty]: { ...previousMapRecord.difficultyScores[difficulty], [shift.orientation]: Math.max(previousMapRecord.difficultyScores[difficulty][shift.orientation], score) }
        },
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
      const evidence = shift.evidence;
      const types = evidence ? Object.values(evidence.landedTypes).map(v => nonNegativeInteger(v, 'Aircraft landings')) : [];
      if (evidence && types.reduce((a, b) => a + b, 0) !== safeLandings) throw new RangeError('Aircraft evidence must match safe landings');
      const initialSafe = evidence ? nonNegativeInteger(evidence.initialSafeLandings, 'Initial safe landings') : 0;
      if (initialSafe > safeLandings) throw new RangeError('Invalid warning-free count');
      const next: GameSaveV3 = {
        ...current,
        lastCommittedRunId: shift.runId,
        achievementEvidence: {
          mixedFleetBest: Math.max(current.achievementEvidence.mixedFleetBest, types.filter(n => n > 0).length),
          initialSafeBest: Math.max(current.achievementEvidence.initialSafeBest, initialSafe)
        },
        career: {
          ...current.career,
          ...totals,
          earnedRankId
        },
        mapRecords
      };
      const achievementResult = evaluateAchievements(next, Date.now());
      return {
        save: { ...next, achievements: achievementResult.awards },
        result: {
          newAchievements: achievementResult.newIds,
          previousRankId: current.career.earnedRankId,
          earnedRankId,
          promoted: earnedRankId !== current.career.earnedRankId
        }
      };
    }).then(({ save, result, persisted }) => ({
      save,
      persisted,
      ...result
    }));
  }

  setTwoEndLanding(enabled: boolean): Promise<GameSaveV3> {
    return this.enqueue(async current => ({
      save: { ...current, settings: { ...current.settings, twoEndLanding: enabled === true } },
      result: undefined
    })).then(({ save }) => save);
  }

  selectDifficulty(difficulty: DifficultyId): Promise<GameSaveV3> {
    if (!isDifficulty(difficulty)) return Promise.reject(new RangeError('Invalid difficulty'));
    return this.enqueue(async current => ({ save: { ...current, selectedDifficulty: difficulty }, result: undefined })).then(({ save }) => save);
  }

  selectMap(mapId: MapId): Promise<GameSaveV3> {
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

  updateAudio(settings: Partial<AudioSettings>): Promise<GameSaveV3> {
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

  acknowledgeEarnedRank(): Promise<GameSaveV3> {
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

  private async ensureLoaded(): Promise<GameSaveV3> {
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
    update: (current: GameSaveV3) => Promise<{
      readonly save: GameSaveV3;
      readonly result: Result;
    }>
  ): Promise<{ readonly save: GameSaveV3; readonly result: Result; readonly persisted: boolean }> {
    const operation = this.updateQueue.then(async () => {
      const current = await this.ensureLoaded();
      const { save, result } = await update(current);
      const next = cloneGameSave(save);
      this.snapshot = next;
      let persisted = true;
      try {
        await this.persistence.write(next);
      } catch {
        persisted = false;
        // The in-memory snapshot remains authoritative for this session.
      }
      return {
        save: cloneGameSave(next),
        persisted,
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

export function loadCareerSave(): Promise<GameSaveV3> {
  return defaultStore.load();
}

export function saveCompletedShift(shift: CompletedShift): Promise<CompletedShiftResult> {
  return defaultStore.recordShift(shift);
}

export function setSelectedMap(mapId: MapId): Promise<GameSaveV3> {
  return defaultStore.selectMap(mapId);
}

export function updateAudioSettings(settings: Partial<AudioSettings>): Promise<GameSaveV3> {
  return defaultStore.updateAudio(settings);
}

export function acknowledgeEarnedRank(): Promise<GameSaveV3> {
  return defaultStore.acknowledgeEarnedRank();
}

/**
 * Transitional view used by the current single-map main module. New integration
 * should consume GameSaveV3 through loadCareerSave and saveCompletedShift.
 */
export interface GameSave extends GameSaveV3 {
  readonly bestScore: number;
  readonly bestScores: Readonly<Record<CareerOrientation, number>>;
  readonly totalLandings: number;
  readonly shiftsPlayed: number;
  readonly soundEnabled: boolean;
}

function compatibilityView(save: GameSaveV3): GameSave {
  const currentRecord = save.mapRecords[save.selectedMapId];
  return {
    ...save,
    bestScore: Math.max(currentRecord.difficultyScores.medium.portrait, currentRecord.difficultyScores.medium.landscape),
    bestScores: { ...currentRecord.difficultyScores.medium },
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
  GameSaveV3,
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
