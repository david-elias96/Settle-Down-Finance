import { describe, expect, it } from 'vitest';
import { chunkedStore, type KeyValue } from './chunkedStore';

function memory() {
  const m = new Map<string, string>();
  const kv: KeyValue = {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v); },
    remove: async (k) => { m.delete(k); },
  };
  return { m, kv };
}

const long = (c: string) => c.repeat(4000);

describe('chunkedStore', () => {
  it('saves and reads back a long value', async () => {
    const { kv } = memory();
    const s = chunkedStore(kv);
    await s.setItem('sb', long('a'));
    expect(await s.getItem('sb')).toBe(long('a'));
  });

  it('replaces the old generation and leaves nothing behind', async () => {
    const { m, kv } = memory();
    let n = 0;
    const s = chunkedStore(kv, () => `g${n++}`);
    await s.setItem('sb', long('a'));
    await s.setItem('sb', long('b'));
    expect(await s.getItem('sb')).toBe(long('b'));
    expect([...m.keys()].filter((k) => k.startsWith('sb.g0'))).toEqual([]);
    await s.removeItem('sb');
    expect(m.size).toBe(0);
  });

  it('keeps the previous session if a save is cut short before the pointer moves', async () => {
    const { m, kv } = memory();
    let n = 0;
    const s = chunkedStore(kv, () => `g${n++}`);
    await s.setItem('sb', long('a'));
    // A second save that wrote one chunk and then the app was killed.
    m.set('sb.g1.0', 'partial');
    expect(await s.getItem('sb')).toBe(long('a'));
  });

  it('reads and upgrades the older format', async () => {
    const { m, kv } = memory();
    m.set('sb.n', '2'); m.set('sb.0', 'hello '); m.set('sb.1', 'world');
    const s = chunkedStore(kv, () => 'g0');
    expect(await s.getItem('sb')).toBe('hello world');
    await s.setItem('sb', 'new');
    expect(await s.getItem('sb')).toBe('new');
    expect(m.has('sb.n') || m.has('sb.0') || m.has('sb.1')).toBe(false);
  });
});
