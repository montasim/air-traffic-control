import {
  DEFAULT_MAP_ID,
  MAP_IDS,
  isMapId,
  type MapId
} from '../game/maps/mapIds';
import {
  DEFAULT_RANK_ID,
  evaluateEarnedRank,
  isRankId,
  rankIndex,
  type CareerOrientation,
  type RankId
} from '../progression/ranks';

export const SAVE_SCHEMA_VERSION = 2 as const;
export const DEFAULT_AUDIO_VOLUME = 0.8;

export interface AudioSettings {
  readonly enabled: boolean;
  readonly volume: number;
}

export interface GameSettings {
  readonly audio: AudioSettings;
}

export interface CareerState {
  readonly totalSafeLandings: number;
  readonly shiftsPlayed: number;
  readonly earnedRankId: RankId;
  readonly acknowledgedRankId: RankId;
}

export interface MapRecord {
  readonly bestScores: Readonly<Record<CareerOrientation, number>>;
  readonly safeLandings: number;
  readonly shiftsPlayed: number;
}

export type MapRecords = Readonly<Record<MapId, MapRecord>>;

export interface GameSaveV2 {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly selectedMapId: MapId;
  readonly settings: GameSettings;
  readonly career: CareerState;
  readonly mapRecords: MapRecords;
}

interface LegacyGameSaveV1 {
  readonly schemaVersion: 1;
  readonly bestScore?: unknown;
  readonly bestScores?: unknown;
  readonly totalLandings?: unknown;
  readonly shiftsPlayed?: unknown;
  readonly soundEnabled?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function audioVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_AUDIO_VOLUME;
}

function emptyMapRecord(): MapRecord {
  return {
    bestScores: { portrait: 0, landscape: 0 },
    safeLandings: 0,
    shiftsPlayed: 0
  };
}

export function createEmptyMapRecords(): Record<MapId, MapRecord> {
  return Object.fromEntries(MAP_IDS.map((mapId) => [mapId, emptyMapRecord()])) as Record<MapId, MapRecord>;
}

export function createDefaultGameSave(): GameSaveV2 {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    selectedMapId: DEFAULT_MAP_ID,
    settings: {
      audio: {
        enabled: true,
        volume: DEFAULT_AUDIO_VOLUME
      }
    },
    career: {
      totalSafeLandings: 0,
      shiftsPlayed: 0,
      earnedRankId: DEFAULT_RANK_ID,
      acknowledgedRankId: DEFAULT_RANK_ID
    },
    mapRecords: createEmptyMapRecords()
  };
}

function normalizeMapRecord(value: unknown): MapRecord {
  const record = isObject(value) ? value : {};
  const scores = isObject(record.bestScores) ? record.bestScores : {};
  return {
    bestScores: {
      portrait: nonNegativeInteger(scores.portrait),
      landscape: nonNegativeInteger(scores.landscape)
    },
    safeLandings: nonNegativeInteger(record.safeLandings),
    shiftsPlayed: nonNegativeInteger(record.shiftsPlayed)
  };
}

function normalizeMapRecords(value: unknown): Record<MapId, MapRecord> {
  const source = isObject(value) ? value : {};
  const records = createEmptyMapRecords();
  for (const mapId of MAP_IDS) records[mapId] = normalizeMapRecord(source[mapId]);
  return records;
}

function normalizeV2(value: Record<string, unknown>): GameSaveV2 {
  const defaults = createDefaultGameSave();
  const records = normalizeMapRecords(value.mapRecords);
  const settings = isObject(value.settings) ? value.settings : {};
  const storedAudio = isObject(settings.audio) ? settings.audio : {};
  const career = isObject(value.career) ? value.career : {};

  const recordSafeLandings = MAP_IDS.reduce(
    (total, mapId) => total + records[mapId].safeLandings,
    0
  );
  const recordShifts = MAP_IDS.reduce(
    (total, mapId) => total + records[mapId].shiftsPlayed,
    0
  );
  const totals = {
    totalSafeLandings: Math.max(
      recordSafeLandings,
      nonNegativeInteger(career.totalSafeLandings)
    ),
    shiftsPlayed: Math.max(recordShifts, nonNegativeInteger(career.shiftsPlayed))
  };
  const evaluatedRankId = evaluateEarnedRank(totals, records);
  const earnedRankId = isRankId(career.earnedRankId)
    ? career.earnedRankId
    : evaluatedRankId;
  const requestedAcknowledgedRankId = isRankId(career.acknowledgedRankId)
    ? career.acknowledgedRankId
    : earnedRankId;
  const acknowledgedRankId = rankIndex(requestedAcknowledgedRankId) <= rankIndex(earnedRankId)
    ? requestedAcknowledgedRankId
    : earnedRankId;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    selectedMapId: isMapId(value.selectedMapId) ? value.selectedMapId : DEFAULT_MAP_ID,
    settings: {
      audio: {
        enabled: booleanValue(storedAudio.enabled, defaults.settings.audio.enabled),
        volume: audioVolume(storedAudio.volume)
      }
    },
    career: {
      ...totals,
      earnedRankId,
      acknowledgedRankId
    },
    mapRecords: records
  };
}

function migrateV1(value: LegacyGameSaveV1): GameSaveV2 {
  const scores = isObject(value.bestScores) ? value.bestScores : {};
  const legacyBest = nonNegativeInteger(value.bestScore);
  const portraitBest = typeof scores.portrait === 'number' && Number.isFinite(scores.portrait)
    ? nonNegativeInteger(scores.portrait)
    : legacyBest;
  const records = createEmptyMapRecords();
  records[DEFAULT_MAP_ID] = {
    bestScores: {
      portrait: portraitBest,
      landscape: nonNegativeInteger(scores.landscape)
    },
    safeLandings: nonNegativeInteger(value.totalLandings),
    shiftsPlayed: nonNegativeInteger(value.shiftsPlayed)
  };
  const totals = {
    totalSafeLandings: records[DEFAULT_MAP_ID].safeLandings,
    shiftsPlayed: records[DEFAULT_MAP_ID].shiftsPlayed
  };
  const migratedRankId = evaluateEarnedRank(totals, records);

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    selectedMapId: DEFAULT_MAP_ID,
    settings: {
      audio: {
        enabled: booleanValue(value.soundEnabled, true),
        volume: DEFAULT_AUDIO_VOLUME
      }
    },
    career: {
      ...totals,
      earnedRankId: migratedRankId,
      // Migrated progress is already acknowledged, preventing historical promotion cues.
      acknowledgedRankId: migratedRankId
    },
    mapRecords: records
  };
}

export function migrateGameSave(value: unknown): GameSaveV2 {
  if (!isObject(value)) return createDefaultGameSave();
  if (value.schemaVersion === SAVE_SCHEMA_VERSION) return normalizeV2(value);
  if (value.schemaVersion === 1) return migrateV1(value as unknown as LegacyGameSaveV1);
  return createDefaultGameSave();
}

export function cloneGameSave(save: GameSaveV2): GameSaveV2 {
  const records = createEmptyMapRecords();
  for (const mapId of MAP_IDS) {
    records[mapId] = {
      ...save.mapRecords[mapId],
      bestScores: { ...save.mapRecords[mapId].bestScores }
    };
  }
  return {
    ...save,
    settings: { audio: { ...save.settings.audio } },
    career: { ...save.career },
    mapRecords: records
  };
}
