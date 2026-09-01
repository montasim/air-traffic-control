import type { AircraftType } from './types';

export const AIRCRAFT_TYPES = ['liner', 'commuter', 'rotor'] as const satisfies readonly AircraftType[];

export type SpawnEdge = 'top' | 'right' | 'bottom' | 'left';

export interface OpeningSpawn {
  at: number;
  type: AircraftType;
}

export interface WeightedAircraftType {
  type: AircraftType;
  weight: number;
}

export interface SpawnIntervalStage {
  at: number;
  interval: number;
  transition?: 'hold' | 'linear';
}

export interface TrafficLimitStage {
  at: number;
  limit: number;
}

export interface NormalizedRegion {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface NormalizedSpawnCorridor {
  edge: SpawnEdge;
  from: number;
  to: number;
  weight?: number;
}

export interface TrafficProfile {
  openingSpawns: readonly OpeningSpawn[];
  aircraftTypeWeights: readonly WeightedAircraftType[];
  spawnIntervalStages: readonly SpawnIntervalStage[];
  trafficLimitStages: readonly TrafficLimitStage[];
  speedMultipliers: Readonly<Record<AircraftType, number>>;
  spawnCorridors?: readonly NormalizedSpawnCorridor[];
  inwardTargetRegion?: NormalizedRegion;
}

export interface ResolvedSpawnCorridor {
  readonly edge: SpawnEdge;
  readonly from: number;
  readonly to: number;
  readonly weight: number;
}

export interface ResolvedTrafficProfile {
  readonly openingSpawns: readonly Readonly<OpeningSpawn>[];
  readonly aircraftTypeWeights: readonly Readonly<WeightedAircraftType>[];
  readonly spawnIntervalStages: readonly Readonly<Required<SpawnIntervalStage>>[];
  readonly trafficLimitStages: readonly Readonly<TrafficLimitStage>[];
  readonly speedMultipliers: Readonly<Record<AircraftType, number>>;
  readonly spawnCorridors?: readonly ResolvedSpawnCorridor[];
  readonly inwardTargetRegion?: Readonly<NormalizedRegion>;
}

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number`);
  }
  return value;
};

const finitePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite number greater than zero`);
  }
  return value;
};

const finiteNumber = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
};

const clampUnit = (value: number, label: string): number =>
  Math.min(1, Math.max(0, finiteNumber(value, label)));

const assertStartsAtZero = (stages: readonly { at: number }[], label: string): void => {
  if (stages.length === 0) throw new Error(`${label} must contain at least one stage`);
  if (stages[0].at !== 0) throw new Error(`${label} must begin at zero seconds`);
  for (let index = 1; index < stages.length; index += 1) {
    if (stages[index - 1].at === stages[index].at) {
      throw new Error(`${label} cannot contain duplicate start times`);
    }
  }
};

const freezeList = <T extends object>(values: T[]): readonly Readonly<T>[] =>
  Object.freeze(values.map((value) => Object.freeze(value)));

function resolveRegion(region: NormalizedRegion, label: string): Readonly<NormalizedRegion> {
  const firstX = clampUnit(region.minX, `${label}.minX`);
  const secondX = clampUnit(region.maxX, `${label}.maxX`);
  const firstY = clampUnit(region.minY, `${label}.minY`);
  const secondY = clampUnit(region.maxY, `${label}.maxY`);
  return Object.freeze({
    minX: Math.min(firstX, secondX),
    maxX: Math.max(firstX, secondX),
    minY: Math.min(firstY, secondY),
    maxY: Math.max(firstY, secondY)
  });
}

/**
 * Validates a map-authored traffic profile and returns immutable, sorted data for Simulation.
 * Normalized geometry is clamped to the world, and relative weights are normalized to sum to one.
 */
export function resolveTrafficProfile(profile: TrafficProfile): ResolvedTrafficProfile {
  const openingSpawns = [...profile.openingSpawns]
    .map((spawn, index) => ({
      at: finiteNonNegative(spawn.at, `openingSpawns[${index}].at`),
      type: spawn.type
    }))
    .sort((first, second) => first.at - second.at);

  const rawWeights = profile.aircraftTypeWeights.map((entry, index) => ({
    type: entry.type,
    weight: finiteNonNegative(entry.weight, `aircraftTypeWeights[${index}].weight`)
  }));
  const duplicateType = AIRCRAFT_TYPES.find(
    (type) => rawWeights.filter((entry) => entry.type === type).length > 1
  );
  if (duplicateType) throw new Error(`aircraftTypeWeights contains duplicate type: ${duplicateType}`);
  const totalAircraftWeight = rawWeights.reduce((total, entry) => total + entry.weight, 0);
  if (totalAircraftWeight <= 0) {
    throw new Error('aircraftTypeWeights must contain at least one positive weight');
  }
  const aircraftTypeWeights = rawWeights
    .filter((entry) => entry.weight > 0)
    .map((entry) => ({ ...entry, weight: entry.weight / totalAircraftWeight }));

  const spawnIntervalStages = [...profile.spawnIntervalStages]
    .map((stage, index) => ({
      at: finiteNonNegative(stage.at, `spawnIntervalStages[${index}].at`),
      interval: finitePositive(stage.interval, `spawnIntervalStages[${index}].interval`),
      transition: stage.transition ?? 'hold'
    }))
    .sort((first, second) => first.at - second.at);
  assertStartsAtZero(spawnIntervalStages, 'spawnIntervalStages');

  const trafficLimitStages = [...profile.trafficLimitStages]
    .map((stage, index) => ({
      at: finiteNonNegative(stage.at, `trafficLimitStages[${index}].at`),
      limit: finitePositive(stage.limit, `trafficLimitStages[${index}].limit`)
    }))
    .sort((first, second) => first.at - second.at);
  for (const stage of trafficLimitStages) {
    if (!Number.isInteger(stage.limit)) throw new Error('traffic limits must be integers');
  }
  assertStartsAtZero(trafficLimitStages, 'trafficLimitStages');

  const speedMultipliers = Object.freeze(Object.fromEntries(
    AIRCRAFT_TYPES.map((type) => [
      type,
      finitePositive(profile.speedMultipliers[type], `speedMultipliers.${type}`)
    ])
  ) as Record<AircraftType, number>);

  let spawnCorridors: readonly ResolvedSpawnCorridor[] | undefined;
  if (profile.spawnCorridors) {
    const rawCorridors = profile.spawnCorridors.map((corridor, index) => {
      const first = clampUnit(corridor.from, `spawnCorridors[${index}].from`);
      const second = clampUnit(corridor.to, `spawnCorridors[${index}].to`);
      return {
        edge: corridor.edge,
        from: Math.min(first, second),
        to: Math.max(first, second),
        weight: finitePositive(corridor.weight ?? 1, `spawnCorridors[${index}].weight`)
      };
    });
    if (rawCorridors.length === 0) throw new Error('spawnCorridors cannot be empty when supplied');
    const totalCorridorWeight = rawCorridors.reduce((total, corridor) => total + corridor.weight, 0);
    spawnCorridors = freezeList(rawCorridors.map((corridor) => ({
      ...corridor,
      weight: corridor.weight / totalCorridorWeight
    }))) as readonly ResolvedSpawnCorridor[];
  }

  return Object.freeze({
    openingSpawns: freezeList(openingSpawns),
    aircraftTypeWeights: freezeList(aircraftTypeWeights),
    spawnIntervalStages: freezeList(spawnIntervalStages) as ResolvedTrafficProfile['spawnIntervalStages'],
    trafficLimitStages: freezeList(trafficLimitStages),
    speedMultipliers,
    spawnCorridors,
    inwardTargetRegion: profile.inwardTargetRegion
      ? resolveRegion(profile.inwardTargetRegion, 'inwardTargetRegion')
      : undefined
  });
}

export const DEFAULT_TRAFFIC_PROFILE: ResolvedTrafficProfile = resolveTrafficProfile({
  openingSpawns: [
    { at: 0, type: 'commuter' },
    { at: 12, type: 'liner' },
    { at: 24, type: 'rotor' }
  ],
  aircraftTypeWeights: [
    { type: 'liner', weight: 1 },
    { type: 'commuter', weight: 1 },
    { type: 'rotor', weight: 1 }
  ],
  spawnIntervalStages: [
    { at: 0, interval: 9 },
    { at: 90, interval: 7, transition: 'linear' },
    { at: 180, interval: 5.2, transition: 'linear' },
    { at: 300, interval: 4, transition: 'linear' },
    { at: 360, interval: 3.5 }
  ],
  trafficLimitStages: [
    { at: 0, limit: 3 },
    { at: 30, limit: 4 },
    { at: 60, limit: 5 },
    { at: 90, limit: 6 },
    { at: 135, limit: 7 },
    { at: 180, limit: 8 },
    { at: 240, limit: 9 },
    { at: 300, limit: 10 }
  ],
  speedMultipliers: { liner: 0.52, commuter: 0.52, rotor: 0.52 },
  inwardTargetRegion: { minX: 0.25, maxX: 0.75, minY: 0.25, maxY: 0.68 }
});
