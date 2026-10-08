import type { DifficultyId } from '../core/difficulty';
import type { AircraftCollisionScales } from '../core/aircraftCollision';
import { isMapId, type MapId } from '../game/maps/mapIds';

export const CHALLENGE_RULESET_ID = 'challenge-v1' as const;
export type ChallengeOrientation = 'portrait' | 'landscape';

const WORLDS = {
  portrait: { width: 900, height: 1600 },
  landscape: { width: 1600, height: 900 },
} as const;

/** ponytail: initial proof scale; tune on devices before opening the pilot and version the ruleset if it changes. */
const COLLISION_SCALES: AircraftCollisionScales = {
  liner: 1,
  commuter: 1,
  rotor: 1,
};

export interface FrozenChallengeRun {
  readonly ruleset: typeof CHALLENGE_RULESET_ID;
  readonly mapId: MapId;
  readonly difficulty: DifficultyId;
  readonly orientation: ChallengeOrientation;
  readonly seed: number;
  readonly twoEndLanding: false;
  readonly world: { readonly width: number; readonly height: number };
  readonly collisionScales: AircraftCollisionScales;
  readonly maxTicks: number;
  readonly maxCommands: number;
  readonly maxPointsPerCommand: number;
}

export function createChallengeRun(
  mapId: MapId,
  orientation: ChallengeOrientation,
  seed: number,
): FrozenChallengeRun {
  if (!isMapId(mapId)) throw new RangeError('Unknown challenge map');
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    throw new RangeError('Unknown challenge orientation');
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('Challenge seed must be an unsigned 32-bit integer');
  }

  return {
    ruleset: CHALLENGE_RULESET_ID,
    mapId,
    difficulty: 'medium',
    orientation,
    seed,
    twoEndLanding: false,
    world: WORLDS[orientation],
    collisionScales: COLLISION_SCALES,
    maxTicks: 60 * 60 * 30,
    maxCommands: 2_000,
    maxPointsPerCommand: 1_024,
  };
}
