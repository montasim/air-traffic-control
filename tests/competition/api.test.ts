import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetlifyDB } from '@netlify/database-dev';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createChallengeRun } from '../../src/competition/rules';
import { verifyRun, type RouteCommand } from '../../src/competition/verifyRun';
import { mapDefinitionById } from '../../src/game/maps/registry';

const credential = 'A'.repeat(43);
let database: NetlifyDB;
let challenge: (request: Request) => Promise<Response>;
let start: (request: Request) => Promise<Response>;
let submit: (request: Request) => Promise<Response>;
let feedback: (request: Request) => Promise<Response>;
let closeDatabase: () => Promise<void>;

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8888${path}`, {
    ...init,
    headers: { Origin: 'http://localhost:5173', ...init.headers },
  });
}

beforeAll(async () => {
  database = new NetlifyDB({ logger: () => undefined });
  process.env.DATABASE_URL = await database.start();
  process.env.COMPETITION_CREDENTIAL_PEPPER = 'integration-test-pepper';
  const databaseClient = await import('../../netlify/database/client');
  closeDatabase = databaseClient.closeDatabase;
  await migrate(databaseClient.db, { migrationsFolder: 'drizzle' });
  await database.exec(
    `UPDATE challenges SET enabled = false;
     UPDATE challenges SET enabled = true, starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour'
     WHERE slug = 'tower-challenge-1';`,
  );
  challenge = (await import('../../netlify/functions/challenge.mts')).default;
  start = (await import('../../netlify/functions/challenge-start.mts')).default;
  submit = (await import('../../netlify/functions/challenge-submit.mts')).default;
  feedback = (await import('../../netlify/functions/challenge-feedback.mts')).default;
}, 30_000);

afterAll(async () => {
  await closeDatabase();
  await database.stop();
  delete process.env.DATABASE_URL;
  delete process.env.COMPETITION_CREDENTIAL_PEPPER;
});

describe('competition API', () => {
  it('starts, verifies, ranks, and idempotently returns an anonymous run', async () => {
    const preflight = await challenge(request('/api/challenge', { method: 'OPTIONS' }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const active = await challenge(request('/api/challenge'));
    expect(active.status).toBe(200);
    const activeBody = await active.json() as { challenge: { id: string } };
    expect(activeBody.challenge.id).toBeTruthy();

    const started = await start(request('/api/challenge/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'portrait', requestId: crypto.randomUUID() }),
    }));
    expect(started.status).toBe(201);
    const run = await started.json() as { runId: string };

    const submission = () => submit(request('/api/challenge/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: run.runId, commands: [] }),
    }));
    const verified = await submission();
    expect(verified.status).toBe(200);
    expect(await verified.json()).toMatchObject({ status: 'verified', score: 0, rank: 1, personalBest: 0 });

    const retry = await submission();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ status: 'verified', score: 0, rank: 1, improved: true });
    const changedRetry = await submit(request('/api/challenge/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: run.runId, commands: [{ tick: 0, sequence: 0, aircraftId: 1, points: [{ x: 100, y: 100 }] }] }),
    }));
    expect(changedRetry.status).toBe(409);

    let thirdResult: { feedbackRequested: boolean } | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const nextStart = await start(request('/api/challenge/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'portrait', requestId: crypto.randomUUID() }),
      }));
      const nextRun = await nextStart.json() as { runId: string };
      const nextSubmit = await submit(request('/api/challenge/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: nextRun.runId, commands: [] }),
      }));
      thirdResult = await nextSubmit.json() as { feedbackRequested: boolean };
    }
    expect(thirdResult?.feedbackRequested).toBe(true);

    const feedbackRequest = (challengeId = activeBody.challenge.id) => feedback(request('/api/challenge/feedback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, fairness: 'agree', factor: 'same-rules' }),
    }));
    expect((await feedbackRequest('8c429424-6fe7-4ef6-b324-010000000002')).status).toBe(409);
    expect((await feedbackRequest()).status).toBe(200);
    expect((await feedbackRequest()).status).toBe(409);

    const requestId = crypto.randomUUID();
    const openRun = await start(request('/api/challenge/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'portrait', requestId }),
    }));
    expect(openRun.status).toBe(201);
    const conflictingRetry = await start(request('/api/challenge/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'landscape', requestId }),
    }));
    expect(conflictingRetry.status).toBe(409);

    const replacement = await start(request('/api/challenge/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'portrait', requestId: crypto.randomUUID() }),
    }));
    expect(replacement.status).toBe(201);
    const replacementRun = await replacement.json() as { runId: string };
    const abandoned = await database.query<{ status: string; rejection_code: string }>(
      `SELECT status, rejection_code FROM runs ORDER BY started_at DESC`,
    );
    expect(abandoned.rows.some((row) => row.rejection_code === 'run-abandoned')).toBe(true);

    await database.exec(`UPDATE challenges SET enabled = false WHERE id = '${activeBody.challenge.id}'`);
    const disabledSubmit = await submit(request('/api/challenge/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: replacementRun.runId, commands: [] }),
    }));
    expect(disabledSubmit.status).toBe(503);
    expect(await disabledSubmit.json()).toMatchObject({ error: 'challenge-disabled' });
    await database.exec(`UPDATE challenges SET enabled = true WHERE id = '${activeBody.challenge.id}'`);

    const rules = createChallengeRun('saltmarsh-gateway', 'portrait', 170011);
    const destination = mapDefinitionById(rules.mapId)
      .prepare({ ...rules.world, detailLevel: 'desktop', twoEndLanding: false })
      .layout.landingZones.find((zone) => zone.accepts === 'commuter')!;
    const copiedCommands: RouteCommand[] = [{
      tick: 0, sequence: 0, aircraftId: 1,
      destinationZoneId: destination.id, points: [{ ...destination.position }],
    }];
    expect(verifyRun(rules, copiedCommands).score).toBeGreaterThanOrEqual(0);
    const copiedResults = await Promise.all(['B', 'C'].map(async (identity) => {
      const copiedCredential = identity.repeat(43);
      const copiedStart = await start(request('/api/challenge/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${copiedCredential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: activeBody.challenge.id, orientation: 'portrait', requestId: crypto.randomUUID() }),
      }));
      const copiedRun = await copiedStart.json() as { runId: string };
      const copiedSubmit = await submit(request('/api/challenge/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${copiedCredential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: copiedRun.runId, commands: copiedCommands }),
      }));
      return { status: copiedSubmit.status, body: await copiedSubmit.json() as Record<string, unknown> };
    }));
    expect(copiedResults.map((result) => result.status).sort(), JSON.stringify(copiedResults)).toEqual([200, 422]);
    expect(copiedResults.find((result) => result.status === 422)?.body).toMatchObject({ error: 'duplicate-replay' });
  }, 30_000);
});
