import { sql } from 'drizzle-orm';
import { db } from '../database/client';

export default async function handler(): Promise<Response> {
  await db.execute(sql`
    UPDATE runs SET status = 'expired', rejection_code = 'run-expired'
    WHERE status = 'started' AND expires_at < now()
  `);
  const replays = await db.execute(sql`
    UPDATE runs SET replay = NULL
    WHERE replay IS NOT NULL AND submitted_at < now() - interval '30 days'
  `);
  const terminal = await db.execute(sql`
    DELETE FROM runs
    WHERE (status = 'rejected' AND submitted_at < now() - interval '30 days')
       OR (status = 'expired' AND expires_at < now() - interval '30 days')
  `);
  const feedback = await db.execute(sql`
    DELETE FROM challenge_feedback WHERE created_at < now() - interval '90 days'
  `);
  return Response.json({
    replaysCleared: replays.rowCount ?? 0,
    terminalRunsDeleted: terminal.rowCount ?? 0,
    feedbackDeleted: feedback.rowCount ?? 0,
  });
}

export const config = { schedule: '@daily' };
