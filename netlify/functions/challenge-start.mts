import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { StartChallengeRequest, StartChallengeResponse } from '../../src/competition/contracts';
import { CHALLENGE_RULESET_ID } from '../../src/competition/rules';
import { db, transaction } from '../database/client';
import {
  HttpError, activeChallenge, errorResponse, findOrCreatePlayer, isOrientation,
  isUuid, json, options, publicChallenge, readJson,
} from './_competition.mts';
import type { ChallengeRow } from './_competition.mts';

interface RunRow extends Record<string, unknown> { id: string; challenge_id: string; orientation: 'portrait' | 'landscape'; expires_at: Date }

export default async function handler(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json(request, { error: 'method-not-allowed' }, 405);
  try {
    const { value } = await readJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid-request');
    const body = value as Partial<StartChallengeRequest>;
    if (!isUuid(body.challengeId) || !isOrientation(body.orientation) || !isUuid(body.requestId)
      || Object.keys(body).some((key) => !['challengeId', 'orientation', 'requestId'].includes(key))) {
      throw new HttpError(400, 'invalid-request');
    }
    const player = await findOrCreatePlayer(request);
    const active = await activeChallenge();
    if (!active) throw new HttpError(410, 'challenge-closed');
    let challenge: ChallengeRow = active;
    if (challenge.id !== body.challengeId) throw new HttpError(410, 'challenge-closed');
    if (challenge.ruleset !== CHALLENGE_RULESET_ID || challenge.difficulty !== 'medium' || challenge.two_end_landing) {
      throw new HttpError(409, 'update-required');
    }

    let run = (await db.execute<RunRow>(sql`
      SELECT id, challenge_id, orientation, expires_at FROM runs
      WHERE player_id = ${player.id} AND request_key = ${body.requestId}
    `)).rows[0];
    if (run && (run.challenge_id !== challenge.id || run.orientation !== body.orientation)) {
      throw new HttpError(409, 'idempotency-conflict');
    }
    if (!run) {
      await transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM players WHERE id = ${player.id} FOR UPDATE`);
        const lockedChallenge = (await tx.execute<ChallengeRow & { enabled: boolean }>(sql`
          SELECT id, slug, starts_at, ends_at, map_id, difficulty, two_end_landing, ruleset, seed, enabled
          FROM challenges WHERE id = ${challenge.id} FOR SHARE
        `)).rows[0];
        if (!lockedChallenge?.enabled || new Date(lockedChallenge.starts_at).getTime() > Date.now()
          || new Date(lockedChallenge.ends_at).getTime() <= Date.now()) {
          throw new HttpError(410, 'challenge-closed');
        }
        if (lockedChallenge.ruleset !== CHALLENGE_RULESET_ID || lockedChallenge.difficulty !== 'medium' || lockedChallenge.two_end_landing) {
          throw new HttpError(409, 'update-required');
        }
        challenge = lockedChallenge;
        run = (await tx.execute<RunRow>(sql`
          SELECT id, challenge_id, orientation, expires_at FROM runs
          WHERE player_id = ${player.id} AND request_key = ${body.requestId}
        `)).rows[0];
        if (run && (run.challenge_id !== challenge.id || run.orientation !== body.orientation)) {
          throw new HttpError(409, 'idempotency-conflict');
        }
        if (!run) {
          const recent = await tx.execute<{ count: string }>(sql`
            SELECT count(*) FROM runs
            WHERE player_id = ${player.id} AND started_at > now() - interval '1 hour'
          `);
          if (Number(recent.rows[0]?.count ?? 0) >= 60) throw new HttpError(429, 'too-many-attempts');
          const runId = randomUUID();
          const expiresAt = new Date(new Date(challenge.ends_at).getTime() + 15 * 60_000);
          run = (await tx.execute<RunRow>(sql`
            INSERT INTO runs (id, challenge_id, player_id, map_id, request_key, orientation, seed, ruleset, expires_at)
            VALUES (${runId}, ${challenge.id}, ${player.id}, ${challenge.map_id}, ${body.requestId},
              ${body.orientation}, ${Number(challenge.seed)}, ${challenge.ruleset}, ${expiresAt})
            RETURNING id, challenge_id, orientation, expires_at
          `)).rows[0];
          await tx.execute(sql`
            UPDATE runs SET status = 'expired', rejection_code = 'run-abandoned'
            WHERE player_id = ${player.id} AND status = 'started' AND id <> ${runId}
          `);
        }
      });
    }
    if (!run) throw new Error('Unable to create run');
    const response: StartChallengeResponse = {
      runId: run.id,
      expiresAt: new Date(run.expires_at).toISOString(),
      challenge: publicChallenge(challenge),
      player: { id: player.id, callsign: player.callsign },
    };
    return json(request, response, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config = {
  path: '/api/challenge/start',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
