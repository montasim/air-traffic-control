import type { AircraftType } from './types';
import {
  DEFAULT_TRAFFIC_PROFILE,
  type ResolvedTrafficProfile,
  type SpawnIntervalStage
} from './trafficProfile';

export const AIRCRAFT_SPEED_SCALE = 0.52;
export const AIRCRAFT_SPEED_VARIANCE = 0.03;

export const AIRCRAFT_PHYSICS: Record<
  AircraftType,
  { baseSpeed: number; collisionRadius: number }
> = {
  liner: { baseSpeed: 118, collisionRadius: 22 },
  commuter: { baseSpeed: 92, collisionRadius: 18 },
  rotor: { baseSpeed: 72, collisionRadius: 17 }
};

export const OPENING_SPAWNS: readonly { at: number; type: AircraftType }[] = [
  ...DEFAULT_TRAFFIC_PROFILE.openingSpawns
];

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * Math.min(1, Math.max(0, progress));

export function aircraftSpeed(
  baseSpeed: number,
  randomUnit: number,
  speedMultiplier = AIRCRAFT_SPEED_SCALE
): number {
  const variance = lerp(-AIRCRAFT_SPEED_VARIANCE, AIRCRAFT_SPEED_VARIANCE, randomUnit);
  return baseSpeed * speedMultiplier * (1 + variance);
}

function activeStageIndex<T extends { at: number }>(elapsedSeconds: number, stages: readonly T[]): number {
  for (let index = stages.length - 1; index > 0; index -= 1) {
    if (elapsedSeconds >= stages[index].at) return index;
  }
  return 0;
}

export function spawnIntervalAt(
  elapsedSeconds: number,
  profile: ResolvedTrafficProfile = DEFAULT_TRAFFIC_PROFILE
): number {
  const stages = profile.spawnIntervalStages;
  const index = activeStageIndex(elapsedSeconds, stages);
  const stage: Required<SpawnIntervalStage> = stages[index];
  const next = stages[index + 1];
  if (stage.transition === 'linear' && next) {
    return lerp(stage.interval, next.interval, (elapsedSeconds - stage.at) / (next.at - stage.at));
  }
  return stage.interval;
}

export function trafficLimitAt(
  elapsedSeconds: number,
  profile: ResolvedTrafficProfile = DEFAULT_TRAFFIC_PROFILE
): number {
  return profile.trafficLimitStages[
    activeStageIndex(elapsedSeconds, profile.trafficLimitStages)
  ].limit;
}

export function aircraftTypeAt(
  randomUnit: number,
  profile: ResolvedTrafficProfile = DEFAULT_TRAFFIC_PROFILE
): AircraftType {
  const unit = Math.min(1, Math.max(0, randomUnit));
  let cumulativeWeight = 0;
  for (const entry of profile.aircraftTypeWeights) {
    cumulativeWeight += entry.weight;
    if (unit < cumulativeWeight) return entry.type;
  }
  return profile.aircraftTypeWeights[profile.aircraftTypeWeights.length - 1].type;
}
