import { resolveTrafficProfile, type ResolvedTrafficProfile } from './trafficProfile';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DifficultyId = typeof DIFFICULTIES[number];
export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const DIFFICULTY_DESCRIPTIONS = { easy: 'More time to plan', medium: 'A balanced challenge', hard: 'Busy skies, quick decisions' };
export function isDifficulty(value: unknown): value is DifficultyId {
  return DIFFICULTIES.includes(value as DifficultyId);
}
export function applyDifficulty(base: ResolvedTrafficProfile, difficulty: DifficultyId): ResolvedTrafficProfile {
  if (difficulty === 'medium') return base;
  const easy = difficulty === 'easy';
  const interval = easy ? 1.35 : .8;
  const time = easy ? 1.3 : .85;
  const speed = easy ? .9 : 1.1;
  return resolveTrafficProfile({
    ...base,
    openingSpawns: base.openingSpawns.map(s => ({ ...s, at: s.at * interval })),
    spawnIntervalStages: base.spawnIntervalStages.map(s => ({ ...s, at: s.at * time, interval: s.interval * interval })),
    trafficLimitStages: base.trafficLimitStages.map(s => ({ at: s.at * time, limit: easy ? Math.max(2, Math.min(8, s.limit - 1)) : Math.min(11, s.limit + 1) })),
    speedMultipliers: { liner: base.speedMultipliers.liner * speed, commuter: base.speedMultipliers.commuter * speed, rotor: base.speedMultipliers.rotor * speed }
  });
}
