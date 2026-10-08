import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, index, integer, jsonb, pgTable, primaryKey, text,
  timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  mapId: text('map_id').notNull(),
  difficulty: text('difficulty').notNull(),
  twoEndLanding: boolean('two_end_landing').notNull().default(false),
  ruleset: text('ruleset').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
}, (table) => [
  check('challenges_map_id_check', sql`${table.mapId} IN ('saltmarsh-gateway', 'river-bend', 'desert-parallel', 'twin-banks')`),
  check('challenges_difficulty_check', sql`${table.difficulty} IN ('easy', 'medium', 'hard')`),
  check('challenges_seed_check', sql`${table.seed} BETWEEN 0 AND 4294967295`),
  check('challenges_window_check', sql`${table.startsAt} < ${table.endsAt}`),
]);

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  credentialHash: text('credential_hash').notNull().unique(),
  callsign: text('callsign').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  check('players_callsign_length_check', sql`char_length(${table.callsign}) BETWEEN 3 AND 32`),
]);

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  mapId: text('map_id').notNull(),
  requestKey: uuid('request_key').notNull(),
  orientation: text('orientation').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  ruleset: text('ruleset').notNull(),
  status: text('status').notNull().default('started'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  score: integer('score'),
  gameOverReason: text('game_over_reason'),
  endTick: integer('end_tick'),
  rejectionCode: text('rejection_code'),
  submitAttempts: integer('submit_attempts').notNull().default(0),
  verificationMs: integer('verification_ms'),
  commandCount: integer('command_count').notNull().default(0),
  payloadBytes: integer('payload_bytes').notNull().default(0),
  replayHash: text('replay_hash'),
  replay: jsonb('replay'),
}, (table) => [
  unique('runs_player_request_unique').on(table.playerId, table.requestKey),
  check('runs_map_id_check', sql`${table.mapId} IN ('saltmarsh-gateway', 'river-bend', 'desert-parallel', 'twin-banks')`),
  check('runs_orientation_check', sql`${table.orientation} IN ('portrait', 'landscape')`),
  check('runs_seed_check', sql`${table.seed} BETWEEN 0 AND 4294967295`),
  check('runs_status_check', sql`${table.status} IN ('started', 'verified', 'rejected', 'expired')`),
  check('runs_score_check', sql`${table.score} IS NULL OR ${table.score} >= 0`),
  check('runs_game_over_reason_check', sql`${table.gameOverReason} IS NULL OR ${table.gameOverReason} IN ('collision', 'airspace')`),
  check('runs_end_tick_check', sql`${table.endTick} IS NULL OR ${table.endTick} >= 0`),
  check('runs_submit_attempts_check', sql`${table.submitAttempts} >= 0`),
  check('runs_verification_ms_check', sql`${table.verificationMs} IS NULL OR ${table.verificationMs} >= 0`),
  check('runs_command_count_check', sql`${table.commandCount} >= 0`),
  check('runs_payload_bytes_check', sql`${table.payloadBytes} >= 0`),
  index('runs_challenge_player_started').on(table.challengeId, table.playerId, table.startedAt.desc()),
  index('runs_open_by_player').on(table.playerId, table.status, table.expiresAt),
  uniqueIndex('runs_replay_hash').on(table.challengeId, table.orientation, table.replayHash)
    .where(sql`${table.status} = 'verified' AND ${table.commandCount} > 0`),
]);

export const leaderboardEntries = pgTable('leaderboard_entries', {
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  orientation: text('orientation').notNull(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  bestRunId: uuid('best_run_id').notNull().unique().references(() => runs.id),
  score: integer('score').notNull(),
  achievedAt: timestamp('achieved_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.challengeId, table.orientation, table.playerId] }),
  check('leaderboard_entries_orientation_check', sql`${table.orientation} IN ('portrait', 'landscape')`),
  check('leaderboard_entries_score_check', sql`${table.score} >= 0`),
  index('leaderboard_rank').on(table.challengeId, table.orientation, table.score.desc(), table.achievedAt, table.bestRunId),
]);

export const challengeFeedback = pgTable('challenge_feedback', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  fairness: text('fairness').notNull(),
  factor: text('factor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('challenge_feedback_fairness_check', sql`${table.fairness} IN ('agree', 'unsure', 'disagree')`),
  check('challenge_feedback_factor_check', sql`${table.factor} IN ('same-rules', 'device-controls', 'pausing', 'suspicious-scores', 'connection-verification')`),
]);

export type ChallengeRecord = typeof challenges.$inferSelect;
export type PlayerRecord = typeof players.$inferSelect;
export type RunRecord = typeof runs.$inferSelect;
