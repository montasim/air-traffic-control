import { cloneGameSave, type GameSaveV2 } from './gameSave';

const DATABASE_NAME = 'vector-approach';
const STORE_NAME = 'state';
const SAVE_KEY = 'game-save';
const DATABASE_VERSION = 1;

export interface SavePersistence {
  read(): Promise<unknown>;
  write(save: GameSaveV2): Promise<void>;
}

export class MemorySavePersistence implements SavePersistence {
  private value: unknown;

  constructor(initialValue?: unknown) {
    this.value = initialValue;
  }

  async read(): Promise<unknown> {
    return this.value;
  }

  async write(save: GameSaveV2): Promise<void> {
    this.value = cloneGameSave(save);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

export class IndexedDbSavePersistence implements SavePersistence {
  async read(): Promise<unknown> {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(SAVE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to read save data'));
      });
    } finally {
      database.close();
    }
  }

  async write(save: GameSaveV2): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(save, SAVE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(
          transaction.error ?? new Error('Unable to write save data')
        );
        transaction.onabort = () => reject(
          transaction.error ?? new Error('Save transaction was aborted')
        );
      });
    } finally {
      database.close();
    }
  }
}
