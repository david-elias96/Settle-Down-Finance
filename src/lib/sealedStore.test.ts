import { describe, expect, it } from 'vitest';
import { sealedStore, type Kv } from './sealedStore';

const memoryKv = () => {
  const m = new Map<string, unknown>();
  const kv: Kv = { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
  return { m, kv };
};

describe('sealedStore (web session storage)', () => {
  it('round-trips a value and never stores the plain text', async () => {
    const { m, kv } = memoryKv();
    const s = await sealedStore(kv, crypto.subtle);
    await s.set('sb-session', '{"access_token":"abc.def"}');
    expect(await s.get('sb-session')).toBe('{"access_token":"abc.def"}');
    const raw = m.get('v:sb-session') as { data: ArrayBuffer };
    expect(new TextDecoder().decode(raw.data)).not.toContain('access_token');
  });

  it('uses a key that cannot be exported', async () => {
    const { m, kv } = memoryKv();
    await sealedStore(kv, crypto.subtle);
    const key = m.get('__key') as CryptoKey;
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('keeps the same key across reopen, and drops tampered values', async () => {
    const { m, kv } = memoryKv();
    await (await sealedStore(kv, crypto.subtle)).set('s', 'hello');
    const again = await sealedStore(kv, crypto.subtle);
    expect(await again.get('s')).toBe('hello');
    const raw = m.get('v:s') as { data: ArrayBuffer };
    new Uint8Array(raw.data)[0] ^= 1;
    expect(await again.get('s')).toBeNull();
    expect(m.has('v:s')).toBe(false);
  });

  it('removes values', async () => {
    const { kv } = memoryKv();
    const s = await sealedStore(kv, crypto.subtle);
    await s.set('s', 'x');
    await s.remove('s');
    expect(await s.get('s')).toBeNull();
  });
});
