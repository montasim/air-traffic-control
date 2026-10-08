/// <reference types="node" />
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { ChallengeOrientation } from '../../src/competition/rules';
import type { PublicChallenge, Standing } from '../../src/competition/contracts';
import { db } from '../database/client';

export const MAX_BODY_BYTES = 512 * 1024;

const DEFAULT_ORIGINS = new Set([
  'https://airtrafficcontrol.netlify.app',
  'http://localhost',
  'https://localhost',
  'aircontrol://game',
]);

function allowedOrigins(): Set<string> {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(process.env.COMPETITION_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  ]);
}

function originAllowed(origin: string): boolean {
  if (allowedOrigins().has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin, Authorization',
  };
  if (origin && originAllowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(request: Request, value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: { ...corsHeaders(request), 'Cache-Control': 'no-store', ...headers },
  });
}

export function options(request: Request): Response | undefined {
  if (request.method !== 'OPTIONS') return;
  const origin = request.headers.get('origin');
  if (origin && !originAllowed(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function readJson(request: Request): Promise<{ value: unknown; bytes: number }> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'json-required');
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'payload-too-large');
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'payload-too-large');
  try {
    return { value: JSON.parse(text), bytes };
  } catch {
    throw new HttpError(400, 'invalid-json');
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = 'HttpError';
  }
}

export function errorResponse(request: Request, error: unknown): Response {
  if (error instanceof HttpError) return json(request, { error: error.code }, error.status);
  console.error('competition-request-failed', error instanceof Error ? error.name : 'unknown');
  return json(request, { error: 'temporarily-unavailable' }, 503, { 'Retry-After': '5' });
}

function credentialFrom(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'identity-required');
  const credential = authorization.slice(7);
  if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new HttpError(401, 'invalid-identity');
  return credential;
}

function credentialHash(credential: string): string {
  const pepper = process.env.COMPETITION_CREDENTIAL_PEPPER ?? '';
  if (!pepper && process.env.CONTEXT === 'production') throw new Error('COMPETITION_CREDENTIAL_PEPPER is required');
  return createHash('sha256').update(`${pepper || 'local-development'}:${credential}`).digest('hex');
}

interface PlayerRow extends Record<string, unknown> { id: string; credential_hash: string; callsign: string; revoked_at: Date | null }

export async function findPlayer(request: Request, required = true): Promise<PlayerRow | undefined> {
  const authorization = request.headers.get('authorization');
  if (!authorization && !required) return;
  const hash = credentialHash(credentialFrom(request));
  const result = await db.execute<PlayerRow>(sql`
    SELECT id, credential_hash, callsign, revoked_at FROM players WHERE credential_hash = ${hash}
  `);
  const player = result.rows[0];
  if (!player) throw new HttpError(401, 'invalid-identity');
  const actual = Buffer.from(player.credential_hash, 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(401, 'invalid-identity');
  if (player.revoked_at) throw new HttpError(403, 'identity-revoked');
  return player;
}

export async function findOrCreatePlayer(request: Request): Promise<PlayerRow> {
  const hash = credentialHash(credentialFrom(request));
  const found = await db.execute<PlayerRow>(sql`
    SELECT id, credential_hash, callsign, revoked_at FROM players WHERE credential_hash = ${hash}
  `);
  if (found.rows[0]) {
    if (found.rows[0].revoked_at) throw new HttpError(403, 'identity-revoked');
    return found.rows[0];
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const player: PlayerRow = {
      id: randomUUID(),
      credential_hash: hash,
      callsign: `Controller ${randomInt(100_000, 1_000_000)}`,
      revoked_at: null,
    };
    const inserted = await db.execute<PlayerRow>(sql`
      INSERT INTO players (id, credential_hash, callsign)
      VALUES (${player.id}, ${player.credential_hash}, ${player.callsign})
      ON CONFLICT DO NOTHING
      RETURNING id, credential_hash, callsign, revoked_at
    `);
    if (inserted.rows[0]) return inserted.rows[0];
    const raced = await db.execute<PlayerRow>(sql`
      SELECT id, credential_hash, callsign, revoked_at FROM players WHERE credential_hash = ${hash}
    `);
    if (raced.rows[0]) return raced.rows[0];
  }
  throw new Error('Unable to allocate callsign');
}

export interface ChallengeRow extends Record<string, unknown> {
  id: string;
  slug: string;
  starts_at: Date;
  ends_at: Date;
  map_id: PublicChallenge['mapId'];
  difficulty: PublicChallenge['difficulty'];
  two_end_landing: boolean;
  ruleset: string;
  seed: string | number;
}

export function publicChallenge(row: ChallengeRow): PublicChallenge {
  return {
    id: row.id,
    slug: row.slug,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    mapId: row.map_id,
    difficulty: row.difficulty,
    twoEndLanding: row.two_end_landing,
    ruleset: row.ruleset,
    seed: Number(row.seed),
  };
}

export async function activeChallenge(): Promise<ChallengeRow | undefined> {
  const result = await db.execute<ChallengeRow>(sql`
    SELECT id, slug, starts_at, ends_at, map_id, difficulty, two_end_landing, ruleset, seed
    FROM challenges
    WHERE enabled = true AND starts_at <= now() AND ends_at > now()
    ORDER BY starts_at DESC LIMIT 1
  `);
  return result.rows[0];
}

interface StandingRow extends Record<string, unknown> { rank: string | number; callsign: string; score: number; player_id: string }

export async function standings(
  challengeId: string,
  orientation: ChallengeOrientation,
  playerId?: string,
): Promise<Standing[]> {
  const result = await db.execute<StandingRow>(sql`
    WITH ranked AS (
      SELECT dense_rank() OVER (ORDER BY le.score DESC) AS rank,
             row_number() OVER (ORDER BY le.score DESC, le.achieved_at ASC, le.best_run_id ASC) AS position,
             le.player_id, p.callsign, le.score
      FROM leaderboard_entries le
      JOIN players p ON p.id = le.player_id
      WHERE le.challenge_id = ${challengeId} AND le.orientation = ${orientation} AND p.revoked_at IS NULL
    ), mine AS (SELECT position FROM ranked WHERE player_id = ${playerId ?? null}::uuid)
    SELECT rank, callsign, score, player_id
    FROM ranked
    WHERE position <= 50 OR (${playerId ?? null}::uuid IS NOT NULL
      AND abs(position - COALESCE((SELECT position FROM mine), -1000)) <= 2)
    ORDER BY position
  `);
  return result.rows.map((row) => ({
    rank: Number(row.rank),
    callsign: row.callsign,
    score: row.score,
    isPlayer: row.player_id === playerId,
  }));
}

export async function shouldRequestFeedback(playerId: string): Promise<boolean> {
  const result = await db.execute<{ eligible: boolean }>(sql`
    SELECT (SELECT count(*) FROM runs WHERE player_id = ${playerId} AND status = 'verified') >= 3
      AND NOT EXISTS (SELECT 1 FROM challenge_feedback WHERE player_id = ${playerId}) AS eligible
  `);
  return result.rows[0]?.eligible === true;
}

export function isOrientation(value: unknown): value is ChallengeOrientation {
  return value === 'portrait' || value === 'landscape';
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function replayHash(commands: unknown): string {
  return createHash('sha256').update(JSON.stringify(commands)).digest('hex');
}
