import type { Bucket, MerchantRule, Transaction } from './types';
import { DEFAULT_BUCKETS, FALLBACK_BUCKET_ID, PLAID_DETAILED_OVERRIDES } from './defaultBuckets';

export interface CategorizeResult {
  bucketId: string;
  source: 'rule' | 'auto';
}

/**
 * Picks a bucket for a transaction. Household merchant rules win over Plaid's
 * categories, so "COSTCO → Groceries" beats Plaid's GENERAL_MERCHANDISE guess.
 */
export function categorize(
  tx: Pick<Transaction, 'merchant' | 'plaidCategory' | 'plaidDetailedCategory'>,
  rules: MerchantRule[],
  buckets: Pick<Bucket, 'id' | 'archived'>[],
): CategorizeResult {
  const active = new Set(buckets.filter((b) => !b.archived).map((b) => b.id));
  const merchant = tx.merchant.toLowerCase();

  // Longest match first, so "target optical" beats "target".
  const rule = [...rules]
    .sort((a, b) => b.match.length - a.match.length)
    .find((r) => active.has(r.bucketId) && merchant.includes(r.match.toLowerCase()));
  if (rule) return { bucketId: rule.bucketId, source: 'rule' };

  const detailed = tx.plaidDetailedCategory && PLAID_DETAILED_OVERRIDES[tx.plaidDetailedCategory];
  if (detailed && active.has(detailed)) return { bucketId: detailed, source: 'auto' };

  if (tx.plaidCategory) {
    const match = DEFAULT_BUCKETS.find((b) => b.plaidPrimary.includes(tx.plaidCategory!));
    if (match && active.has(match.id)) return { bucketId: match.id, source: 'auto' };
  }

  return { bucketId: active.has(FALLBACK_BUCKET_ID) ? FALLBACK_BUCKET_ID : [...active][0], source: 'auto' };
}
