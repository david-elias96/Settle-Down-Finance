/**
 * Encrypted key-value store for the web app's auth session (see sessionStorage.web.ts).
 * Values are sealed with AES-GCM under a non-extractable CryptoKey; a fresh 12-byte IV per write.
 */

/** Minimal async key-value store holding structured-cloneable values (IndexedDB in the browser). */
export interface Kv {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SealedStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const KEY_SLOT = '__key';
const PREFIX = 'v:';

type Sealed = { iv: Uint8Array; data: ArrayBuffer };

export async function sealedStore(kv: Kv, subtle: SubtleCrypto): Promise<SealedStore> {
  let key = (await kv.get(KEY_SLOT)) as CryptoKey | undefined;
  if (!key) {
    // extractable: false — the key bytes can never be exported, only used here.
    key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await kv.put(KEY_SLOT, key);
  }
  const k = key;
  return {
    async get(name) {
      const sealed = (await kv.get(PREFIX + name)) as Sealed | undefined;
      if (!sealed) return null;
      try {
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource }, k, sealed.data);
        return new TextDecoder().decode(plain);
      } catch {
        // Tampered or sealed under an older key: treat as signed out.
        await kv.delete(PREFIX + name);
        return null;
      }
    },
    async set(name, value) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, new TextEncoder().encode(value));
      await kv.put(PREFIX + name, { iv, data } satisfies Sealed);
    },
    async remove(name) { await kv.delete(PREFIX + name); },
  };
}

/** IndexedDB-backed Kv (one object store in one database). */
export function indexedDbKv(idb: IDBFactory, dbName = 'settledown-auth', storeName = 'session'): Kv {
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(storeName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => db.then((d) => new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction(storeName, mode).objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    put: async (key, value) => { await run('readwrite', (s) => s.put(value, key)); },
    delete: async (key) => { await run('readwrite', (s) => s.delete(key)); },
  };
}

export const openSealedStore = (idb: IDBFactory, subtle: SubtleCrypto) => sealedStore(indexedDbKv(idb), subtle);
