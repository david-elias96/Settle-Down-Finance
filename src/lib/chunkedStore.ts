/** A small async key-value store (the Keychain, in the app). */
export type KeyValue = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const CHUNK = 1800;

/**
 * Stores one long value (the auth session) as several small items. Each save writes its chunks
 * under a new generation and only then moves the pointer to it, so a save cut short (the app
 * killed mid-write) leaves the previous session readable instead of a half-written mix, and a
 * rotated refresh token is never stitched to an old one. Still reads the older format
 * (`key.n` + `key.0…`), so people stay signed in across the update.
 */
export function chunkedStore(kv: KeyValue, newGeneration = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`) {
  const pointerKey = (key: string) => `${key}.ptr`;

  /** Chunk keys of whatever is saved now: the current generation, or the older format. */
  async function current(key: string): Promise<{ pointer: boolean; keys: string[] }> {
    const ptr = await kv.get(pointerKey(key));
    const m = ptr ? /^([a-z0-9]+):(\d+)$/.exec(ptr) : null;
    if (m) return { pointer: true, keys: Array.from({ length: Number(m[2]) }, (_, i) => `${key}.${m[1]}.${i}`) };
    const n = Number(await kv.get(`${key}.n`)) || 0;
    return { pointer: false, keys: Array.from({ length: n }, (_, i) => `${key}.${i}`) };
  }

  return {
    async getItem(key: string) {
      const { keys } = await current(key);
      if (!keys.length) return null;
      const parts = await Promise.all(keys.map((k) => kv.get(k)));
      return parts.some((p) => p == null) ? null : parts.join('');
    },
    async setItem(key: string, value: string) {
      const before = await current(key);
      const gen = newGeneration();
      const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
      await Promise.all(parts.map((p, i) => kv.set(`${key}.${gen}.${i}`, p)));
      await kv.set(pointerKey(key), `${gen}:${parts.length}`);
      // The new session is in place; clear out the one it replaced.
      if (!before.pointer && before.keys.length) await kv.remove(`${key}.n`);
      await Promise.all(before.keys.map((k) => kv.remove(k)));
    },
    async removeItem(key: string) {
      const { pointer, keys } = await current(key);
      await kv.remove(pointer ? pointerKey(key) : `${key}.n`);
      await Promise.all(keys.map((k) => kv.remove(k)));
    },
  };
}
