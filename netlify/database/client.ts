import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
try {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username) throw new Error();
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
}

export const pool = new Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool, schema });

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function transaction<T>(callback: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await drizzle({ client, schema }).transaction(callback);
  } finally {
    client.release();
  }
}

export function closeDatabase(): Promise<void> {
  return pool.end();
}
