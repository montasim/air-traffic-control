# Tower Challenge operations

Run these statements only against the intended Neon PostgreSQL branch. Replace
UUID placeholders with values copied from that branch; use a transaction for
multi-statement actions. The application has no admin UI by design.

## Release checklist

1. In Infisical, set `COMPETITION_CREDENTIAL_PEPPER` to a long random production
   secret. Never rotate it during the pilot unless all anonymous identities may
   be invalidated.
2. In the same Infisical environment and `/` path, set the pooled Neon connection
   string as server-only `DATABASE_URL`. Configure an Infisical-to-Netlify Secret
   Sync for both values, confirm the Neon budget and alerts, run `npm run
   db:migrate` against a preview branch, then `npm run db:migrate:prod` for
   production. Neither command writes an `.env` file.
3. Confirm the active UTC challenge window, web API, and packaged-app CORS
   origins.
4. Keep `VITE_CHALLENGE_ENABLED=false` until fixed-scale legibility and the full
   start/submit flow pass on the release builds for web, Android, and Electron.
4. To stop new ranked starts immediately without affecting ordinary play:

```sql
UPDATE challenges SET enabled = false WHERE enabled = true;
```

## Moderation and removal

Revoke an anonymous identity and remove all of its public entries:

```sql
BEGIN;
UPDATE players SET revoked_at = now() WHERE id = '<player-uuid>';
DELETE FROM leaderboard_entries WHERE player_id = '<player-uuid>';
COMMIT;
```

Remove one entry while retaining the run for investigation:

```sql
DELETE FROM leaderboard_entries
WHERE challenge_id = '<challenge-uuid>'
  AND orientation = 'portrait'
  AND player_id = '<player-uuid>';
```

Delete retained raw replays immediately (the daily job normally clears them after
30 days):

```sql
UPDATE runs SET replay = NULL WHERE replay IS NOT NULL;
```

## Pilot metrics

Attempts, verified/rejected rates, participants, and repeat attempts by week:

```sql
SELECT c.slug,
       count(*) AS attempts,
       count(*) FILTER (WHERE r.status = 'verified') AS verified,
       count(*) FILTER (WHERE r.status = 'rejected') AS rejected,
       count(DISTINCT r.player_id) AS participants,
       count(*) - count(DISTINCT r.player_id) AS repeat_attempts
FROM runs r JOIN challenges c ON c.id = r.challenge_id
GROUP BY c.id, c.slug ORDER BY c.starts_at;
```

Return and improvement distribution can be calculated from verified runs without
adding a tracking SDK:

```sql
WITH attempts AS (
  SELECT challenge_id, player_id, score,
         row_number() OVER (PARTITION BY challenge_id, player_id ORDER BY submitted_at) AS attempt,
         max(score) OVER (PARTITION BY challenge_id, player_id ORDER BY submitted_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_best
  FROM runs WHERE status = 'verified'
)
SELECT challenge_id,
       count(DISTINCT player_id) AS participants,
       count(DISTINCT player_id) FILTER (WHERE attempt >= 2) AS made_second_attempt,
       count(DISTINCT player_id) FILTER (WHERE score > prior_best) AS improved
FROM attempts GROUP BY challenge_id;
```

Fairness responses:

```sql
SELECT fairness, factor, count(*)
FROM challenge_feedback GROUP BY fairness, factor ORDER BY fairness, factor;
```

Also monitor Netlify function volume and latency, database compute, 4xx/5xx rates,
payload sizes, and bounded rejection codes. Function logs intentionally omit bearer
credentials and replay coordinates.

Verifier latency, retries, and payload size are available without replay access:

```sql
SELECT c.slug,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY r.verification_ms) AS verification_p95_ms,
       avg(r.submit_attempts) AS average_submit_attempts,
       max(r.payload_bytes) AS largest_payload_bytes
FROM runs r JOIN challenges c ON c.id = r.challenge_id
WHERE r.submitted_at IS NOT NULL
GROUP BY c.id, c.slug ORDER BY c.starts_at;
```
