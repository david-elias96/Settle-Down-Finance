import { describe, expect, it } from 'vitest';
import { parseBucketDraft } from './bucketDraft';

const existing = [{ name: 'Groceries', archived: false }, { name: 'Old', archived: true }];

describe('parseBucketDraft', () => {
  it('accepts dollar signs and commas', () => {
    expect(parseBucketDraft('  Pets ', '$1,200.50', existing)).toEqual({ ok: true, name: 'Pets', limit: 120050 });
  });
  it('rejects limits under $1 or over $100,000, and text', () => {
    expect(parseBucketDraft('Pets', '0.001', existing).ok).toBe(false);
    expect(parseBucketDraft('Pets', '0.99', existing).ok).toBe(false);
    expect(parseBucketDraft('Pets', '100001', existing).ok).toBe(false);
    expect(parseBucketDraft('Pets', 'Infinity', existing).ok).toBe(false);
    expect(parseBucketDraft('Pets', '', existing).ok).toBe(false);
  });
  it('rejects blank, long and duplicate names (ignoring case and archived buckets)', () => {
    expect(parseBucketDraft('  ', '50', existing).ok).toBe(false);
    expect(parseBucketDraft('x'.repeat(41), '50', existing).ok).toBe(false);
    expect(parseBucketDraft('groceries', '50', existing)).toEqual({ ok: false, error: 'You already have a bucket called groceries.' });
    expect(parseBucketDraft('old', '50', existing).ok).toBe(true);
  });
});
