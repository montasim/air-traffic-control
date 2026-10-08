import type { ChallengeIdentity, ChallengeResponse } from './contracts';

const DATABASE_NAME = 'vector-approach';
const STORE_NAME = 'state';
const DATABASE_VERSION = 1;
const IDENTITY_KEY = 'competition-identity';
const CHALLENGE_CACHE_KEY = 'competition-challenge-cache';

export interface StoredCompetitionIdentity {
  readonly credential: string;
  readonly playerId?: string;
  readonly callsign?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

async function read<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error ?? new Error('Unable to read competition data'));
    });
  } finally {
    database.close();
  }
}

async function write(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save competition data'));
    });
  } finally {
    database.close();
  }
}

export const loadCompetitionIdentity = () => read<StoredCompetitionIdentity>(IDENTITY_KEY);
export const saveCompetitionIdentity = (identity: StoredCompetitionIdentity | ChallengeIdentity) => write(IDENTITY_KEY, identity);
export const loadCachedChallenge = () => read<ChallengeResponse>(CHALLENGE_CACHE_KEY);
export const saveCachedChallenge = (challenge: ChallengeResponse) => write(CHALLENGE_CACHE_KEY, challenge);

export async function clearCompetitionIdentity(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(IDENTITY_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear competition identity'));
    });
  } finally {
    database.close();
  }
}
