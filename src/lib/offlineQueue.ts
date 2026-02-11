/**
 * Offline queue using IndexedDB.
 * Queues failed Supabase writes when offline, replays on reconnect.
 */

const DB_NAME = "seed-vault-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_writes";

export interface QueuedWrite {
  id: string;
  table: string;
  operation: "insert" | "update" | "upsert" | "delete";
  payload: Record<string, unknown>;
  filters?: Record<string, unknown>;
  created_at: string;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueWrite(write: Omit<QueuedWrite, "id" | "created_at" | "retries">): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const entry: QueuedWrite = {
    ...write,
    id,
    created_at: new Date().toISOString(),
    retries: 0,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingWrites(): Promise<QueuedWrite[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedWrite[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeWrite(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const get = store.get(id);
    get.onsuccess = () => {
      const entry = get.result as QueuedWrite | undefined;
      if (entry) {
        entry.retries += 1;
        store.put(entry);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllWrites(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const writes = await getPendingWrites();
  return writes.length;
}
