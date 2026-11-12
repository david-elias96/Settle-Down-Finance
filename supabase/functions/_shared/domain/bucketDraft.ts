import type { Bucket, Cents } from './types.ts';
import { parseMoney } from './savings.ts';

export const BUCKET_NAME_MAX = 40;
export const BUCKET_LIMIT_MIN: Cents = 100; // $1
export const BUCKET_LIMIT_MAX: Cents = 10_000_000; // $100,000

/**
 * Checks a new bucket typed by someone: a name (up to 40 characters, not already used, ignoring
 * case) and a monthly limit from $1 to $100,000. Accepts "$1,200" or "1200.50".
 */
export function parseBucketDraft(name: string, limit: string, existing: Pick<Bucket, 'name' | 'archived'>[]):
  { ok: true; name: string; limit: Cents } | { ok: false; error: string } {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return { ok: false, error: 'Give the bucket a name.' };
  if (clean.length > BUCKET_NAME_MAX) return { ok: false, error: `Keep the name under ${BUCKET_NAME_MAX} characters.` };
  if (existing.some((b) => !b.archived && b.name.trim().toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: `You already have a bucket called ${clean}.` };
  }
  const cents = parseMoney(limit);
  if (cents === null || !limit.trim()) return { ok: false, error: 'Enter the monthly limit as an amount, like 150.' };
  if (cents < BUCKET_LIMIT_MIN) return { ok: false, error: 'The monthly limit needs to be at least $1.' };
  if (cents > BUCKET_LIMIT_MAX) return { ok: false, error: 'The monthly limit can be at most $100,000.' };
  return { ok: true, name: clean, limit: cents };
}
