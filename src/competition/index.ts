import type {
  ChallengeFeedbackRequest, ChallengeIdentity, ChallengeResponse, StartChallengeResponse,
  SubmitChallengeResponse, SubmitChallengeRequest,
} from './contracts';
import { CHALLENGE_RULESET_ID, type ChallengeOrientation } from './rules';
import { isMapId } from '../game/maps/mapIds';
import {
  clearCompetitionIdentity, loadCachedChallenge, loadCompetitionIdentity,
  saveCachedChallenge, saveCompetitionIdentity, type StoredCompetitionIdentity,
} from './persistence';

const configuredBase = (import.meta.env.VITE_COMPETITION_API_URL as string | undefined)?.replace(/\/$/, '');
const API_BASE = configuredBase ?? (location.protocol === 'http:' || location.protocol === 'https:'
  ? ''
  : 'https://airtrafficcontrol.netlify.app');
export const COMPETITION_ENABLED = import.meta.env.VITE_CHALLENGE_ENABLED !== 'false';

export class CompetitionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly transient: boolean,
  ) {
    super(code);
    this.name = 'CompetitionError';
  }
}

let pendingStart: { challengeId: string; orientation: ChallengeOrientation; requestId: string } | undefined;
let memoryIdentity: StoredCompetitionIdentity | undefined;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createCredential(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function identity(): Promise<StoredCompetitionIdentity> {
  const stored = memoryIdentity ?? await loadCompetitionIdentity().catch(() => undefined);
  if (stored?.credential) return stored;
  const created = { credential: createCredential() };
  memoryIdentity = created;
  await saveCompetitionIdentity(created).catch(() => undefined);
  return created;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  credential?: string,
): Promise<T> {
  if (!COMPETITION_ENABLED) throw new CompetitionError('challenge-disabled', 0, false);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) {
      const code = data.error ?? (response.status === 429 ? 'too-many-attempts' : `http-${response.status}`);
      if (response.status === 401) {
        memoryIdentity = undefined;
        await clearCompetitionIdentity().catch(() => undefined);
      }
      throw new CompetitionError(code, response.status, response.status === 0 || response.status === 429 || response.status >= 500);
    }
    return data;
  } catch (error) {
    if (error instanceof CompetitionError) throw error;
    throw new CompetitionError(error instanceof DOMException && error.name === 'AbortError' ? 'request-timeout' : 'network-unavailable', 0, true);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getChallenge(): Promise<{ data: ChallengeResponse; stale: boolean }> {
  const stored = await loadCompetitionIdentity().catch(() => undefined);
  try {
    const data = await requestJson<ChallengeResponse>(stored?.credential ? '/api/challenge?player=1' : '/api/challenge', {}, stored?.credential);
    if (!validChallengeResponse(data)) throw new CompetitionError('invalid-response', 502, true);
    await saveCachedChallenge(data).catch(() => undefined);
    return { data, stale: false };
  } catch (error) {
    const cached = await loadCachedChallenge().catch(() => undefined);
    if (cached && validChallengeResponse(cached)) return { data: cached, stale: true };
    throw error;
  }
}

export async function startChallenge(challengeId: string, orientation: ChallengeOrientation): Promise<{ run: StartChallengeResponse; identity: ChallengeIdentity }> {
  const stored = await identity();
  if (!pendingStart || pendingStart.orientation !== orientation || pendingStart.challengeId !== challengeId) {
    pendingStart = { challengeId, orientation, requestId: crypto.randomUUID() };
  }
  const run = await requestJson<StartChallengeResponse>('/api/challenge/start', {
    method: 'POST', body: JSON.stringify({ challengeId, orientation, requestId: pendingStart.requestId }),
  }, stored.credential);
  if (!validStartResponse(run)) throw new CompetitionError('invalid-response', 502, true);
  if (run.challenge.id !== challengeId) throw new CompetitionError('challenge-closed', 410, false);
  const nextIdentity: ChallengeIdentity = {
    credential: stored.credential,
    playerId: run.player.id,
    callsign: run.player.callsign,
  };
  memoryIdentity = nextIdentity;
  await saveCompetitionIdentity(nextIdentity).catch(() => undefined);
  pendingStart = undefined;
  return { run, identity: nextIdentity };
}

export async function submitChallenge(payload: SubmitChallengeRequest): Promise<SubmitChallengeResponse> {
  const stored = memoryIdentity ?? await loadCompetitionIdentity().catch(() => undefined);
  if (!stored?.credential) throw new CompetitionError('identity-required', 401, false);
  const result = await requestJson<SubmitChallengeResponse>('/api/challenge/submit', {
    method: 'POST', body: JSON.stringify(payload),
  }, stored.credential);
  if (result.status !== 'verified' || !Number.isSafeInteger(result.score) || result.score < 0
    || !Number.isSafeInteger(result.rank) || result.rank < 0
    || (result.personalBest !== null && (!Number.isSafeInteger(result.personalBest) || result.personalBest < result.score))
    || !Number.isSafeInteger(result.endTick) || result.endTick < 0
    || (result.reason !== 'collision' && result.reason !== 'airspace')
    || typeof result.improved !== 'boolean' || typeof result.feedbackRequested !== 'boolean'
    || !Array.isArray(result.standings) || !result.standings.every(validStanding)) {
    throw new CompetitionError('invalid-response', 502, true);
  }
  return result;
}

export async function submitChallengeFeedback(payload: ChallengeFeedbackRequest): Promise<void> {
  const stored = memoryIdentity ?? await loadCompetitionIdentity().catch(() => undefined);
  if (!stored?.credential) throw new CompetitionError('identity-required', 401, false);
  const result = await requestJson<{ recorded: boolean }>('/api/challenge/feedback', {
    method: 'POST', body: JSON.stringify(payload),
  }, stored.credential);
  if (result.recorded !== true) throw new CompetitionError('invalid-response', 502, true);
}

function validStanding(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.rank) && (item.rank as number) > 0
    && Number.isSafeInteger(item.score) && (item.score as number) >= 0
    && typeof item.callsign === 'string' && item.callsign.length >= 3 && item.callsign.length <= 32
    && typeof item.isPlayer === 'boolean';
}

function validPublicChallenge(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && UUID_PATTERN.test(item.id) && typeof item.slug === 'string'
    && typeof item.startsAt === 'string' && Number.isFinite(Date.parse(item.startsAt))
    && typeof item.endsAt === 'string' && Number.isFinite(Date.parse(item.endsAt))
    && isMapId(item.mapId) && item.difficulty === 'medium' && item.twoEndLanding === false
    && item.ruleset === CHALLENGE_RULESET_ID && Number.isSafeInteger(item.seed)
    && (item.seed as number) >= 0 && (item.seed as number) <= 0xffff_ffff;
}

function validChallengeResponse(value: unknown): value is ChallengeResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const boards = item.standings as Record<string, unknown> | undefined;
  return typeof item.serverTime === 'string' && Number.isFinite(Date.parse(item.serverTime))
    && (item.challenge === null || validPublicChallenge(item.challenge))
    && boards !== undefined && Array.isArray(boards.portrait) && boards.portrait.every(validStanding)
    && Array.isArray(boards.landscape) && boards.landscape.every(validStanding);
}

function validStartResponse(value: unknown): value is StartChallengeResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const player = item.player as Record<string, unknown> | undefined;
  return typeof item.runId === 'string' && UUID_PATTERN.test(item.runId)
    && typeof item.expiresAt === 'string' && Number.isFinite(Date.parse(item.expiresAt))
    && validPublicChallenge(item.challenge) && player !== undefined
    && typeof player.id === 'string' && UUID_PATTERN.test(player.id)
    && typeof player.callsign === 'string' && player.callsign.length >= 3 && player.callsign.length <= 32;
}

export function competitionErrorCopy(error: unknown): string {
  const code = error instanceof CompetitionError ? error.code : 'temporarily-unavailable';
  return ({
    'network-unavailable': 'Connect to the internet and try again.',
    'request-timeout': 'The ranking server took too long to respond. Try again.',
    'challenge-closed': 'This challenge has closed. Refresh for the next assignment.',
    'update-required': 'Update the game to enter this challenge.',
    'too-many-attempts': 'Attempt limit reached. Try again later.',
    'too-many-open-runs': 'Finish or abandon an open attempt before starting another.',
    'run-expired': 'This ranked attempt expired and cannot be submitted.',
    'run-abandoned': 'A newer ranked attempt replaced this one.',
    'idempotency-conflict': 'This start request no longer matches the ranked assignment. Refresh and try again.',
    'duplicate-replay': 'This run matches another entry and could not be verified.',
    'invalid-run': 'This run did not use the current competition rules.',
    'invalid-command': 'This run contained invalid route data.',
    'command-rejected': 'This run could not be reproduced by the ranking server.',
    'command-after-game-over': 'This run contained route data after the shift ended.',
    'run-did-not-finish': 'Only naturally completed shifts can be ranked.',
    'run-already-consumed': 'This ranked attempt was already submitted with different data.',
    'run-not-found': 'This ranked attempt is no longer available.',
    'identity-required': 'This device identity is unavailable. Start a new ranked flight.',
    'invalid-identity': 'This device identity is no longer valid. Start a new ranked flight.',
    'payload-too-large': 'This ranked route log is too large to verify.',
    'invalid-response': 'The ranking server returned an unexpected response. Try again.',
    'feedback-unavailable': 'Feedback was already recorded for this challenge pilot.',
    'challenge-disabled': 'Ranked challenges are temporarily unavailable.',
  } as Record<string, string>)[code] ?? 'Rankings are temporarily unavailable. Try again later.';
}
