import { applyDifficulty } from '../core/difficulty';
import { Simulation, SIMULATION_TICK_SECONDS } from '../core/Simulation';
import type { GameOverReason, Vector2 } from '../core/types';
import { mapDefinitionById } from '../game/maps/registry';
import { trafficProfileById } from '../game/maps/trafficProfiles';
import { createChallengeRun, type FrozenChallengeRun } from './rules';

export interface RouteCommand {
  /** Completed simulation steps; the command is applied before the next step. */
  readonly tick: number;
  readonly sequence: number;
  readonly aircraftId: number;
  readonly destinationZoneId?: string;
  /** Player-drawn continuation points; the aircraft's authoritative position is implicit. */
  readonly points: readonly Vector2[];
}

export interface VerifiedRun {
  readonly score: number;
  readonly reason: GameOverReason;
  readonly endTick: number;
}

export type VerificationErrorCode =
  | 'invalid-run'
  | 'invalid-command'
  | 'command-limit'
  | 'command-rejected'
  | 'command-after-game-over'
  | 'run-did-not-finish';

export class VerificationError extends Error {
  constructor(readonly code: VerificationErrorCode) {
    super(code);
    this.name = 'VerificationError';
  }
}

function validInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function canonicalRun(run: FrozenChallengeRun): FrozenChallengeRun {
  let expected: FrozenChallengeRun;
  try {
    expected = createChallengeRun(run.mapId, run.orientation, run.seed);
  } catch {
    throw new VerificationError('invalid-run');
  }
  if (
    run.ruleset !== expected.ruleset ||
    run.difficulty !== expected.difficulty ||
    run.twoEndLanding !== expected.twoEndLanding ||
    run.world.width !== expected.world.width ||
    run.world.height !== expected.world.height ||
    run.maxTicks !== expected.maxTicks ||
    run.maxCommands !== expected.maxCommands ||
    run.maxPointsPerCommand !== expected.maxPointsPerCommand ||
    run.collisionScales.liner !== expected.collisionScales.liner ||
    run.collisionScales.commuter !== expected.collisionScales.commuter ||
    run.collisionScales.rotor !== expected.collisionScales.rotor
  ) {
    throw new VerificationError('invalid-run');
  }
  return expected;
}

function validateCommands(
  run: FrozenChallengeRun,
  commands: readonly RouteCommand[],
): void {
  if (commands.length > run.maxCommands) throw new VerificationError('command-limit');

  let previousTick = -1;
  let previousSequence = -1;
  for (const command of commands) {
    if (
      !validInteger(command.tick) ||
      command.tick >= run.maxTicks ||
      !validInteger(command.sequence) ||
      !validInteger(command.aircraftId) ||
      command.points.length === 0 ||
      command.points.length > run.maxPointsPerCommand ||
      (command.destinationZoneId !== undefined && typeof command.destinationZoneId !== 'string') ||
      command.tick < previousTick ||
      (command.tick === previousTick && command.sequence <= previousSequence)
    ) {
      throw new VerificationError('invalid-command');
    }

    for (const point of command.points) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > run.world.width ||
        point.y < 0 ||
        point.y > run.world.height
      ) {
        throw new VerificationError('invalid-command');
      }
    }
    previousTick = command.tick;
    previousSequence = command.sequence;
  }
}

export function verifyRun(
  run: FrozenChallengeRun,
  commands: readonly RouteCommand[],
): VerifiedRun {
  const rules = canonicalRun(run);
  validateCommands(rules, commands);
  const definition = mapDefinitionById(rules.mapId);
  const layout = definition.prepare({
    ...rules.world,
    detailLevel: 'desktop',
    twoEndLanding: rules.twoEndLanding,
  }).layout;
  const simulation = new Simulation(
    layout.landingZones,
    rules.world,
    applyDifficulty(trafficProfileById(definition.trafficProfileId), rules.difficulty),
    rules.collisionScales,
  );
  simulation.start(rules.seed);

  let commandIndex = 0;
  while (simulation.snapshot().tick < rules.maxTicks) {
    const snapshot = simulation.snapshot();
    while (commands[commandIndex]?.tick === snapshot.tick) {
      const command = commands[commandIndex];
      const aircraft = snapshot.aircraft.find((item) => item.id === command.aircraftId);
      if (!aircraft || !simulation.assignRoute(
        command.aircraftId,
        [{ ...aircraft.position }, ...command.points.map((point) => ({ ...point }))],
        command.destinationZoneId,
      ).accepted) {
        throw new VerificationError('command-rejected');
      }
      commandIndex += 1;
    }

    simulation.update(SIMULATION_TICK_SECONDS);
    const gameOver = simulation.drainEvents().find((event) => event.type === 'gameover');
    if (gameOver?.type === 'gameover') {
      if (commandIndex !== commands.length) {
        throw new VerificationError('command-after-game-over');
      }
      const result = simulation.snapshot();
      return { score: result.score, reason: gameOver.reason, endTick: result.tick };
    }
  }

  throw new VerificationError('run-did-not-finish');
}
