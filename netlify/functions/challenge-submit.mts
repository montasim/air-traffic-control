import { sql } from 'drizzle-orm';
import type { RouteCommand } from '../../src/competition/verifyRun';
import { VerificationError, verifyRun } from '../../src/competition/verifyRun';
import { CHALLENGE_RULESET_ID, createChallengeRun } from '../../src/competition/rules';
import type { SubmitChallengeRequest, SubmitChallengeResponse } from '../../src/competition/contracts';
import type { GameOverReason } from '../../src/core/types';
import { isMapId } from '../../src/game/maps/mapIds';
import { db, transaction } from '../database/client';
import {
  HttpError, errorResponse, findPlayer, isOrientation, isUuid, json, options,
  readJson, replayHash, shouldRequestFeedback, standings,
} from './_competition.mts';

interface RunRow extends Record<string, unknown> {
  id: string;
  challenge_id: string;
  player_id: string;
  orientation: 'portrait' | 'landscape';
  seed: string | number;
  ruleset: string;
  status: 'started' | 'verified' | 'rejected' | 'expired';
  expires_at: Date;
  score: number | null;
  game_over_reason: GameOverReason | null;
  end_tick: number | null;
  rejection_code: string | null;
  replay_hash: string | null;
  map_id: string;
}

function parseCommands(value: unknown): RouteCommand[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'invalid-commands');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'invalid-commands');
    const command = item as Record<string, unknown>;
    if (Object.keys(command).some((key) => !['tick', 'sequence', 'aircraftId', 'destinationZoneId', 'points'].includes(key)) || !Array.isArray(command.points)) {
      throw new HttpError(400, 'invalid-commands');
    }
    return {
      tick: command.tick as number,
      sequence: command.sequence as number,
      aircraftId: command.aircraftId as number,
      destinationZoneId: command.destinationZoneId as string | undefined,
      points: command.points.map((point) => {
        if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some((key) => !['x', 'y'].includes(key))) {
          throw new HttpError(400, 'invalid-commands');
        }
        return { x: (point as Record<string, unknown>).x as number, y: (point as Record<string, unknown>).y as number };
      }),
    };
  });
}

function isDuplicateReplayConstraint(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    const databaseError = current as { code?: unknown; cause?: unknown };
    if (databaseError.code === '23505') return true;
    current = databaseError.cause;
  }
  return false;
}

async function terminalResponse(request: Request, run: RunRow, hash: string): Promise<Response> {
  if (run.replay_hash && run.replay_hash !== hash) throw new HttpError(409, 'run-already-consumed');
  if (run.status !== 'verified' || run.score === null || !run.game_over_reason || run.end_tick === null) {
    throw new HttpError(run.status === 'expired' ? 410 : 422, run.rejection_code ?? `run-${run.status}`);
  }
  let board: Awaited<ReturnType<typeof standings>> = [];
  let improved = false;
  let personalBest: number | null = null;
  let feedbackRequested = false;
  try {
    board = await standings(run.challenge_id, run.orientation, run.player_id);
  } catch (error) {
    console.error('competition-standings-unavailable', error instanceof Error ? error.name : 'unknown');
  }
  try {
    const best = await db.execute<{ best_run_id: string; score: number }>(sql`
      SELECT best_run_id, score FROM leaderboard_entries
      WHERE challenge_id = ${run.challenge_id} AND orientation = ${run.orientation} AND player_id = ${run.player_id}
    `);
    improved = best.rows[0]?.best_run_id === run.id;
    personalBest = Number(best.rows[0]?.score);
    if (!Number.isSafeInteger(personalBest) || personalBest < run.score) personalBest = null;
  } catch (error) {
    console.error('competition-personal-best-unavailable', error instanceof Error ? error.name : 'unknown');
  }
  try {
    feedbackRequested = await shouldRequestFeedback(run.player_id);
  } catch (error) {
    console.error('competition-feedback-unavailable', error instanceof Error ? error.name : 'unknown');
  }
  const mine = board.find((entry) => entry.isPlayer);
  const response: SubmitChallengeResponse = {
    status: 'verified', score: run.score, reason: run.game_over_reason, endTick: run.end_tick,
    rank: mine?.rank ?? 0, personalBest: mine?.score ?? personalBest,
    improved, feedbackRequested, standings: board,
  };
  return json(request, response);
}

export default async function handler(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json(request, { error: 'method-not-allowed' }, 405);
  try {
    const { value, bytes } = await readJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid-request');
    const body = value as Partial<SubmitChallengeRequest>;
    if (!isUuid(body.runId) || Object.keys(body).some((key) => !['runId', 'commands'].includes(key))) throw new HttpError(400, 'invalid-request');
    const commands = parseCommands(body.commands);
    const hash = replayHash(commands);
    const player = await findPlayer(request);
    if (!player) throw new HttpError(401, 'invalid-identity');

    const initial = (await db.execute<RunRow>(sql`
      SELECT r.* FROM runs r WHERE r.id = ${body.runId} AND r.player_id = ${player.id}
    `)).rows[0];
    if (!initial) throw new HttpError(404, 'run-not-found');
    if (initial.status !== 'started') {
      await db.execute(sql`UPDATE runs SET submit_attempts = submit_attempts + 1 WHERE id = ${initial.id}`);
      return await terminalResponse(request, initial, hash);
    }
    if (new Date(initial.expires_at).getTime() < Date.now()) {
      await db.execute(sql`
        UPDATE runs SET status = 'expired', rejection_code = 'run-expired', submit_attempts = submit_attempts + 1
        WHERE id = ${initial.id} AND status = 'started'
      `);
      throw new HttpError(410, 'run-expired');
    }
    if (!isMapId(initial.map_id) || !isOrientation(initial.orientation) || initial.ruleset !== CHALLENGE_RULESET_ID) {
      throw new HttpError(409, 'update-required');
    }
    const challengeState = await db.execute<{ enabled: boolean }>(sql`
      SELECT enabled FROM challenges WHERE id = ${initial.challenge_id}
    `);
    if (challengeState.rows[0]?.enabled !== true) throw new HttpError(503, 'challenge-disabled');

    let verified;
    const verificationStarted = performance.now();
    try {
      verified = verifyRun(createChallengeRun(initial.map_id, initial.orientation, Number(initial.seed)), commands);
    } catch (error) {
      const code = error instanceof VerificationError ? error.code : 'verification-failed';
      await db.execute(sql`
        UPDATE runs SET status = 'rejected', submitted_at = now(), rejection_code = ${code},
          command_count = ${commands.length}, payload_bytes = ${bytes}, replay_hash = ${hash},
          submit_attempts = submit_attempts + 1,
          verification_ms = ${Math.round(performance.now() - verificationStarted)}
        WHERE id = ${initial.id} AND status = 'started'
      `);
      throw new HttpError(422, code);
    }

    let outcome;
    try {
      outcome = await transaction(async (tx) => {
        const current = (await tx.execute<RunRow>(sql`
          SELECT r.* FROM runs r
          WHERE r.id = ${initial.id} AND r.player_id = ${player.id} FOR UPDATE
        `)).rows[0];
        if (!current) throw new HttpError(404, 'run-not-found');
        if (current.status !== 'started') {
          return { kind: 'terminal' as const, run: current };
        }
        await tx.execute(sql`SELECT id FROM players WHERE id = ${player.id} FOR UPDATE`);
        if (new Date(current.expires_at).getTime() < Date.now()) throw new HttpError(410, 'run-expired');
        const lockedChallenge = await tx.execute<{ enabled: boolean }>(sql`
          SELECT enabled FROM challenges WHERE id = ${current.challenge_id} FOR SHARE
        `);
        if (lockedChallenge.rows[0]?.enabled !== true) throw new HttpError(503, 'challenge-disabled');
        if (commands.length > 0) {
          await tx.execute(sql`
            SELECT pg_advisory_xact_lock(hashtextextended(${`${current.challenge_id}:${current.orientation}:${hash}`}, 0))
          `);
        }
        const duplicate = commands.length === 0 ? undefined : await tx.execute(sql`
          SELECT 1 FROM runs
          WHERE challenge_id = ${current.challenge_id} AND orientation = ${current.orientation}
            AND replay_hash = ${hash} AND player_id <> ${player.id} AND status = 'verified'
          LIMIT 1
        `);
        if (duplicate?.rowCount) {
          await tx.execute(sql`
            UPDATE runs SET status = 'rejected', submitted_at = now(), rejection_code = 'duplicate-replay',
              command_count = ${commands.length}, payload_bytes = ${bytes}, replay_hash = ${hash},
              submit_attempts = submit_attempts + 1,
              verification_ms = ${Math.round(performance.now() - verificationStarted)}
            WHERE id = ${current.id}
          `);
          return { kind: 'duplicate' as const };
        }
        const previous = await tx.execute<{ score: number }>(sql`
          SELECT score FROM leaderboard_entries
          WHERE challenge_id = ${current.challenge_id} AND orientation = ${current.orientation}
            AND player_id = ${player.id} FOR UPDATE
        `);
        const improved = !previous.rows[0] || verified.score > previous.rows[0].score;
        const personalBest = Math.max(previous.rows[0]?.score ?? 0, verified.score);
        await tx.execute(sql`
          WITH verified_run AS (
            UPDATE runs SET status = 'verified', submitted_at = now(), score = ${verified.score},
              game_over_reason = ${verified.reason}, end_tick = ${verified.endTick},
              command_count = ${commands.length}, payload_bytes = ${bytes}, replay_hash = ${hash},
              replay = ${JSON.stringify(commands)}::jsonb, submit_attempts = submit_attempts + 1,
              verification_ms = ${Math.round(performance.now() - verificationStarted)}
            WHERE id = ${current.id}
            RETURNING challenge_id, orientation, player_id, id
          )
          INSERT INTO leaderboard_entries (challenge_id, orientation, player_id, best_run_id, score, achieved_at)
          SELECT challenge_id, orientation, player_id, id, ${verified.score}, now() FROM verified_run
          ON CONFLICT (challenge_id, orientation, player_id) DO UPDATE
          SET best_run_id = EXCLUDED.best_run_id, score = EXCLUDED.score, achieved_at = EXCLUDED.achieved_at
          WHERE EXCLUDED.score > leaderboard_entries.score
        `);
        return { kind: 'verified' as const, run: current, improved, personalBest };
      });
    } catch (error) {
      if (!isDuplicateReplayConstraint(error)) throw error;
      await db.execute(sql`
        UPDATE runs SET status = 'rejected', submitted_at = now(), rejection_code = 'duplicate-replay',
          command_count = ${commands.length}, payload_bytes = ${bytes}, replay_hash = ${hash},
          submit_attempts = submit_attempts + 1,
          verification_ms = ${Math.round(performance.now() - verificationStarted)}
        WHERE id = ${initial.id} AND status = 'started'
      `);
      throw new HttpError(422, 'duplicate-replay');
    }

    if (outcome.kind === 'terminal') {
      await db.execute(sql`UPDATE runs SET submit_attempts = submit_attempts + 1 WHERE id = ${outcome.run.id}`);
      return await terminalResponse(request, outcome.run, hash);
    }
    if (outcome.kind === 'duplicate') throw new HttpError(422, 'duplicate-replay');
    const finalRun = outcome.run;

    let board: Awaited<ReturnType<typeof standings>> = [];
    let feedbackRequested = false;
    try {
      board = await standings(finalRun.challenge_id, finalRun.orientation, player.id);
    } catch (error) {
      console.error('competition-standings-unavailable', error instanceof Error ? error.name : 'unknown');
    }
    try {
      feedbackRequested = await shouldRequestFeedback(player.id);
    } catch (error) {
      console.error('competition-feedback-unavailable', error instanceof Error ? error.name : 'unknown');
    }
    const mine = board.find((entry) => entry.isPlayer);
    const response: SubmitChallengeResponse = {
      status: 'verified', score: verified.score, reason: verified.reason, endTick: verified.endTick,
      rank: mine?.rank ?? 0, personalBest: mine?.score ?? outcome.personalBest, improved: outcome.improved,
      feedbackRequested, standings: board,
    };
    return json(request, response);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config = {
  path: '/api/challenge/submit',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
