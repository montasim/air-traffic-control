CREATE TABLE "challenge_feedback" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"challenge_id" uuid NOT NULL,
	"fairness" text NOT NULL,
	"factor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_feedback_fairness_check" CHECK ("challenge_feedback"."fairness" IN ('agree', 'unsure', 'disagree')),
	CONSTRAINT "challenge_feedback_factor_check" CHECK ("challenge_feedback"."factor" IN ('same-rules', 'device-controls', 'pausing', 'suspicious-scores', 'connection-verification'))
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"map_id" text NOT NULL,
	"difficulty" text NOT NULL,
	"two_end_landing" boolean DEFAULT false NOT NULL,
	"ruleset" text NOT NULL,
	"seed" bigint NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "challenges_slug_unique" UNIQUE("slug"),
	CONSTRAINT "challenges_map_id_check" CHECK ("challenges"."map_id" IN ('saltmarsh-gateway', 'river-bend', 'desert-parallel', 'twin-banks')),
	CONSTRAINT "challenges_difficulty_check" CHECK ("challenges"."difficulty" IN ('easy', 'medium', 'hard')),
	CONSTRAINT "challenges_seed_check" CHECK ("challenges"."seed" BETWEEN 0 AND 4294967295),
	CONSTRAINT "challenges_window_check" CHECK ("challenges"."starts_at" < "challenges"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"challenge_id" uuid NOT NULL,
	"orientation" text NOT NULL,
	"player_id" uuid NOT NULL,
	"best_run_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"achieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "leaderboard_entries_challenge_id_orientation_player_id_pk" PRIMARY KEY("challenge_id","orientation","player_id"),
	CONSTRAINT "leaderboard_entries_best_run_id_unique" UNIQUE("best_run_id"),
	CONSTRAINT "leaderboard_entries_orientation_check" CHECK ("leaderboard_entries"."orientation" IN ('portrait', 'landscape')),
	CONSTRAINT "leaderboard_entries_score_check" CHECK ("leaderboard_entries"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY NOT NULL,
	"credential_hash" text NOT NULL,
	"callsign" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "players_credential_hash_unique" UNIQUE("credential_hash"),
	CONSTRAINT "players_callsign_unique" UNIQUE("callsign"),
	CONSTRAINT "players_callsign_length_check" CHECK (char_length("players"."callsign") BETWEEN 3 AND 32)
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challenge_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"map_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"orientation" text NOT NULL,
	"seed" bigint NOT NULL,
	"ruleset" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" integer,
	"game_over_reason" text,
	"end_tick" integer,
	"rejection_code" text,
	"submit_attempts" integer DEFAULT 0 NOT NULL,
	"verification_ms" integer,
	"command_count" integer DEFAULT 0 NOT NULL,
	"payload_bytes" integer DEFAULT 0 NOT NULL,
	"replay_hash" text,
	"replay" jsonb,
	CONSTRAINT "runs_player_request_unique" UNIQUE("player_id","request_key"),
	CONSTRAINT "runs_map_id_check" CHECK ("runs"."map_id" IN ('saltmarsh-gateway', 'river-bend', 'desert-parallel', 'twin-banks')),
	CONSTRAINT "runs_orientation_check" CHECK ("runs"."orientation" IN ('portrait', 'landscape')),
	CONSTRAINT "runs_seed_check" CHECK ("runs"."seed" BETWEEN 0 AND 4294967295),
	CONSTRAINT "runs_status_check" CHECK ("runs"."status" IN ('started', 'verified', 'rejected', 'expired')),
	CONSTRAINT "runs_score_check" CHECK ("runs"."score" IS NULL OR "runs"."score" >= 0),
	CONSTRAINT "runs_game_over_reason_check" CHECK ("runs"."game_over_reason" IS NULL OR "runs"."game_over_reason" IN ('collision', 'airspace')),
	CONSTRAINT "runs_end_tick_check" CHECK ("runs"."end_tick" IS NULL OR "runs"."end_tick" >= 0),
	CONSTRAINT "runs_submit_attempts_check" CHECK ("runs"."submit_attempts" >= 0),
	CONSTRAINT "runs_verification_ms_check" CHECK ("runs"."verification_ms" IS NULL OR "runs"."verification_ms" >= 0),
	CONSTRAINT "runs_command_count_check" CHECK ("runs"."command_count" >= 0),
	CONSTRAINT "runs_payload_bytes_check" CHECK ("runs"."payload_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "challenge_feedback" ADD CONSTRAINT "challenge_feedback_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_feedback" ADD CONSTRAINT "challenge_feedback_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_best_run_id_runs_id_fk" FOREIGN KEY ("best_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leaderboard_rank" ON "leaderboard_entries" USING btree ("challenge_id","orientation","score" DESC NULLS LAST,"achieved_at","best_run_id");--> statement-breakpoint
CREATE INDEX "runs_challenge_player_started" ON "runs" USING btree ("challenge_id","player_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "runs_open_by_player" ON "runs" USING btree ("player_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_replay_hash" ON "runs" USING btree ("challenge_id","orientation","replay_hash") WHERE "runs"."status" = 'verified' AND "runs"."command_count" > 0;--> statement-breakpoint
INSERT INTO "challenges" ("id", "slug", "starts_at", "ends_at", "map_id", "difficulty", "two_end_landing", "ruleset", "seed")
VALUES
  ('8c429424-6fe7-4ef6-b324-010000000001', 'tower-challenge-1', '2026-10-05T00:00:00Z', '2026-10-12T00:00:00Z', 'saltmarsh-gateway', 'medium', false, 'challenge-v1', 170011),
  ('8c429424-6fe7-4ef6-b324-010000000002', 'tower-challenge-2', '2026-10-12T00:00:00Z', '2026-10-19T00:00:00Z', 'river-bend', 'medium', false, 'challenge-v1', 270013),
  ('8c429424-6fe7-4ef6-b324-010000000003', 'tower-challenge-3', '2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z', 'desert-parallel', 'medium', false, 'challenge-v1', 370019),
  ('8c429424-6fe7-4ef6-b324-010000000004', 'tower-challenge-4', '2026-10-26T00:00:00Z', '2026-11-02T00:00:00Z', 'twin-banks', 'medium', false, 'challenge-v1', 470021)
ON CONFLICT ("id") DO NOTHING;
