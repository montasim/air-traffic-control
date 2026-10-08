import { describe, expect, it } from 'vitest';
import { applyDifficulty } from '../../src/core/difficulty';
import { Simulation, SIMULATION_TICK_SECONDS } from '../../src/core/Simulation';
import { mapDefinitionById } from '../../src/game/maps/registry';
import { trafficProfileById } from '../../src/game/maps/trafficProfiles';
import { createChallengeRun } from '../../src/competition/rules';
import {
  VerificationError,
  verifyRun,
  type RouteCommand,
  type VerifiedRun,
} from '../../src/competition/verifyRun';

function playLocally(commands: readonly RouteCommand[]): VerifiedRun {
  const run = createChallengeRun('saltmarsh-gateway', 'portrait', 42);
  const definition = mapDefinitionById(run.mapId);
  const layout = definition.prepare({ ...run.world, detailLevel: 'desktop' }).layout;
  const simulation = new Simulation(
    layout.landingZones,
    run.world,
    applyDifficulty(trafficProfileById(definition.trafficProfileId), run.difficulty),
    run.collisionScales,
  );
  simulation.start(run.seed);
  let commandIndex = 0;

  while (simulation.snapshot().tick < run.maxTicks) {
    const snapshot = simulation.snapshot();
    while (commands[commandIndex]?.tick === snapshot.tick) {
      const command = commands[commandIndex++];
      const aircraft = snapshot.aircraft.find((item) => item.id === command.aircraftId)!;
      expect(simulation.assignRoute(
        command.aircraftId,
        [{ ...aircraft.position }, ...command.points],
        command.destinationZoneId,
      ).accepted).toBe(true);
    }
    simulation.update(SIMULATION_TICK_SECONDS);
    const gameOver = simulation.drainEvents().find((event) => event.type === 'gameover');
    if (gameOver?.type === 'gameover') {
      const result = simulation.snapshot();
      return { score: result.score, reason: gameOver.reason, endTick: result.tick };
    }
  }
  throw new Error('fixture did not finish');
}

describe('verified challenge replay', () => {
  it('replays accepted logical route commands to the same authoritative result', () => {
    const run = createChallengeRun('saltmarsh-gateway', 'portrait', 42);
    const layout = mapDefinitionById(run.mapId).prepare({ ...run.world, detailLevel: 'desktop' }).layout;
    const destination = layout.landingZones.find((zone) => zone.accepts === 'commuter')!;
    const commands: RouteCommand[] = [{
      tick: 0,
      sequence: 0,
      aircraftId: 1,
      destinationZoneId: destination.id,
      points: [{ ...destination.position }],
    }];

    expect(verifyRun(run, commands)).toEqual(playLocally(commands));
  });

  it('supports both canonical orientations', () => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const run = createChallengeRun('saltmarsh-gateway', orientation, 7);
      expect(verifyRun(run, [])).toMatchObject({ score: 0 });
    }
  });

  it('rejects malformed and non-reproducible commands', () => {
    const run = createChallengeRun('saltmarsh-gateway', 'portrait', 42);
    expect(() => verifyRun(run, [{
      tick: 0,
      sequence: 0,
      aircraftId: 1,
      points: [{ x: Number.NaN, y: 20 }],
    }])).toThrowError(new VerificationError('invalid-command'));
    expect(() => verifyRun(run, [{
      tick: 0,
      sequence: 0,
      aircraftId: 999,
      points: [{ x: 20, y: 20 }],
    }])).toThrowError(new VerificationError('command-rejected'));
  });

  it('rejects client-tampered rules instead of trusting the typed object', () => {
    const run = createChallengeRun('saltmarsh-gateway', 'portrait', 42);
    expect(() => verifyRun({ ...run, world: { width: 901, height: 1600 } }, []))
      .toThrowError(new VerificationError('invalid-run'));
    expect(() => verifyRun({ ...run, difficulty: 'hard' }, []))
      .toThrowError(new VerificationError('invalid-run'));
  });
});
