import {
  DEFAULT_MAP_ID,
  MAP_IDS,
  type MapId
} from '../game/maps/mapIds';

export const RANK_IDS = [
  'control-trainee',
  'control-assistant',
  'tower-controller',
  'approach-controller',
  'area-controller',
  'senior-controller',
  'chief-controller'
] as const;

export type RankId = (typeof RANK_IDS)[number];

export const DEFAULT_RANK_ID: RankId = 'control-trainee';

export type CareerOrientation = 'portrait' | 'landscape';

export interface RankRequirements {
  readonly minimumSafeLandings: number;
  readonly minimumShifts: number;
  /** A map qualifies when its best score in either orientation reaches this value. */
  readonly qualifyingBestScore: number;
  readonly minimumDistinctMaps: number;
}

export interface RankDefinition {
  readonly id: RankId;
  readonly name: string;
  readonly requirements: RankRequirements;
  /** Maps newly made available at this rank. Unlocks accumulate. */
  readonly unlocks: readonly MapId[];
}

export interface CareerTotals {
  readonly totalSafeLandings: number;
  readonly shiftsPlayed: number;
}

export interface CareerPerformanceRecord {
  readonly bestScores: Readonly<Record<CareerOrientation, number>>;
}

export type CareerPerformanceRecords = Readonly<Record<MapId, CareerPerformanceRecord>>;

export interface PromotionProgress {
  readonly totalSafeLandings: number;
  readonly shiftsPlayed: number;
  readonly qualifyingBestScore: number;
  readonly distinctMaps: number;
}

export const RANK_CATALOG: readonly RankDefinition[] = [
  {
    id: 'control-trainee',
    name: 'Control Trainee',
    requirements: {
      minimumSafeLandings: 0,
      minimumShifts: 0,
      qualifyingBestScore: 0,
      minimumDistinctMaps: 0
    },
    unlocks: [DEFAULT_MAP_ID, 'river-bend']
  },
  {
    id: 'control-assistant',
    name: 'Control Assistant',
    requirements: {
      minimumSafeLandings: 8,
      minimumShifts: 2,
      qualifyingBestScore: 3,
      minimumDistinctMaps: 1
    },
    unlocks: ['desert-parallel', 'executive-point']
  },
  {
    id: 'tower-controller',
    name: 'Tower Controller',
    requirements: {
      minimumSafeLandings: 24,
      minimumShifts: 5,
      qualifyingBestScore: 5,
      minimumDistinctMaps: 2
    },
    unlocks: ['twin-banks', 'metro-international']
  },
  {
    id: 'approach-controller',
    name: 'Approach Controller',
    requirements: {
      minimumSafeLandings: 50,
      minimumShifts: 10,
      qualifyingBestScore: 7,
      minimumDistinctMaps: 3
    },
    unlocks: ['falcon-air-base']
  },
  {
    id: 'area-controller',
    name: 'Area Controller',
    requirements: {
      minimumSafeLandings: 90,
      minimumShifts: 18,
      qualifyingBestScore: 10,
      minimumDistinctMaps: 4
    },
    unlocks: ['freight-junction']
  },
  {
    id: 'senior-controller',
    name: 'Senior Controller',
    requirements: {
      minimumSafeLandings: 150,
      minimumShifts: 28,
      qualifyingBestScore: 13,
      minimumDistinctMaps: 4
    },
    unlocks: ['island-rescue']
  },
  {
    id: 'chief-controller',
    name: 'Chief Controller',
    requirements: {
      minimumSafeLandings: 240,
      minimumShifts: 40,
      qualifyingBestScore: 16,
      minimumDistinctMaps: 4
    },
    unlocks: []
  }
] as const;

export function isRankId(value: unknown): value is RankId {
  return typeof value === 'string' && RANK_IDS.includes(value as RankId);
}

export function rankIndex(
  rankId: RankId,
  catalog: readonly RankDefinition[] = RANK_CATALOG
): number {
  const index = catalog.findIndex((definition) => definition.id === rankId);
  return index < 0 ? 0 : index;
}

export function rankDefinition(
  rankId: RankId,
  catalog: readonly RankDefinition[] = RANK_CATALOG
): RankDefinition {
  return catalog.find((definition) => definition.id === rankId) ?? catalog[0] ?? RANK_CATALOG[0];
}

export function promotionProgress(
  totals: CareerTotals,
  records: CareerPerformanceRecords,
  qualifyingBestScore: number
): PromotionProgress {
  let distinctMaps = 0;

  for (const mapId of MAP_IDS) {
    const scores = records[mapId].bestScores;
    if (Math.max(scores.portrait, scores.landscape) >= qualifyingBestScore) {
      distinctMaps += 1;
    }
  }

  return {
    ...totals,
    qualifyingBestScore,
    distinctMaps
  };
}

export function meetsRankRequirements(
  definition: RankDefinition,
  totals: CareerTotals,
  records: CareerPerformanceRecords
): boolean {
  const requirements = definition.requirements;
  const progress = promotionProgress(totals, records, requirements.qualifyingBestScore);
  return progress.totalSafeLandings >= requirements.minimumSafeLandings
    && progress.shiftsPlayed >= requirements.minimumShifts
    && progress.distinctMaps >= requirements.minimumDistinctMaps;
}

export function evaluateEarnedRank(
  totals: CareerTotals,
  records: CareerPerformanceRecords,
  catalog: readonly RankDefinition[] = RANK_CATALOG
): RankId {
  let earned = catalog[0]?.id ?? DEFAULT_RANK_ID;
  for (const definition of catalog) {
    if (!meetsRankRequirements(definition, totals, records)) break;
    earned = definition.id;
  }
  return earned;
}

export function unlockedMapIds(
  rankId: RankId,
  catalog: readonly RankDefinition[] = RANK_CATALOG
): readonly MapId[] {
  const unlocked = new Set<MapId>();
  const earnedIndex = rankIndex(rankId, catalog);
  catalog.slice(0, earnedIndex + 1).forEach((definition) => {
    definition.unlocks.forEach((mapId) => unlocked.add(mapId));
  });
  return MAP_IDS.filter((mapId) => unlocked.has(mapId));
}

export function isMapUnlocked(
  mapId: MapId,
  rankId: RankId,
  catalog: readonly RankDefinition[] = RANK_CATALOG
): boolean {
  return unlockedMapIds(rankId, catalog).includes(mapId);
}
