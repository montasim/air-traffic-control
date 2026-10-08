import { sql } from 'drizzle-orm';
import type { ChallengeFeedbackRequest } from '../../src/competition/contracts';
import { db } from '../database/client';
import {
  HttpError, errorResponse, findPlayer, isUuid, json, options, readJson,
  shouldRequestFeedback,
} from './_competition.mts';

const FAIRNESS = new Set(['agree', 'unsure', 'disagree']);
const FACTORS = new Set(['same-rules', 'device-controls', 'pausing', 'suspicious-scores', 'connection-verification']);

export default async function handler(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json(request, { error: 'method-not-allowed' }, 405);
  try {
    const { value } = await readJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid-request');
    const body = value as Partial<ChallengeFeedbackRequest>;
    if (!isUuid(body.challengeId) || !FAIRNESS.has(body.fairness ?? '') || !FACTORS.has(body.factor ?? '')
      || Object.keys(body).some((key) => !['challengeId', 'fairness', 'factor'].includes(key))) {
      throw new HttpError(400, 'invalid-request');
    }
    const player = await findPlayer(request);
    if (!player || !await shouldRequestFeedback(player.id)) throw new HttpError(409, 'feedback-unavailable');
    const played = await db.execute(sql`
      SELECT 1 FROM runs
      WHERE player_id = ${player.id} AND challenge_id = ${body.challengeId} AND status = 'verified'
      LIMIT 1
    `);
    if (!played.rowCount) throw new HttpError(409, 'feedback-unavailable');
    await db.execute(sql`
      INSERT INTO challenge_feedback (player_id, challenge_id, fairness, factor)
      VALUES (${player.id}, ${body.challengeId}, ${body.fairness}, ${body.factor})
      ON CONFLICT (player_id) DO NOTHING
    `);
    return json(request, { recorded: true });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config = { path: '/api/challenge/feedback' };
