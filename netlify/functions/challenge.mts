import type { ChallengeResponse } from '../../src/competition/contracts';
import { activeChallenge, errorResponse, findPlayer, json, options, publicChallenge, standings } from './_competition.mts';

export default async function handler(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'GET') return json(request, { error: 'method-not-allowed' }, 405);
  try {
    const player = await findPlayer(request, false);
    const challenge = await activeChallenge();
    const response: ChallengeResponse = {
      challenge: challenge ? publicChallenge(challenge) : null,
      serverTime: new Date().toISOString(),
      standings: challenge ? {
        portrait: await standings(challenge.id, 'portrait', player?.id),
        landscape: await standings(challenge.id, 'landscape', player?.id),
      } : { portrait: [], landscape: [] },
    };
    return json(request, response, 200, player ? {} : { 'Cache-Control': 'public, max-age=30' });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config = {
  path: '/api/challenge',
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
