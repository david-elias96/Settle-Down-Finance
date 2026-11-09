import { categorize, type CategorizeResult } from './categorize';
import { FALLBACK_BUCKET_ID } from './defaultBuckets';
import { vendorKey } from './filters';
import { formatCents } from './money';
import type { Allocation, Bucket, MerchantRule, Transaction } from './types';

/**
 * Automatic bucket sorting. Plain rules go first (the family's own rules, then what they or
 * the AI chose for the same store before, then Plaid's category). Claude is asked only about
 * purchases those can't place confidently, such as a "SQ *" card reader or a store that sells
 * everything, and its answer is remembered per store so it's asked once.
 */

/** Plaid categories too broad to pick a bucket from on their own. */
const AMBIGUOUS = new Set(['GENERAL_MERCHANDISE', 'GENERAL_SERVICES', 'OTHER']);

export interface SortResult {
  bucketId: string;
  source: Allocation['source'];
  /** Shown under the bucket: why it landed there. */
  reason?: string;
  /** True when no rule could place it confidently and Claude should decide. */
  askAi: boolean;
}

/** A past purchase and where it ended up, for learning a store's usual bucket. */
export interface PastChoice {
  merchant: string;
  bucketId: string;
  source: Allocation['source'];
  date: string;
}

/**
 * The bucket this store was last put in by a person (or, failing that, by the AI). Only whole
 * purchases count, so a receipt split doesn't teach that Target is always Kids.
 */
export function learnedBucket(merchant: string, history: PastChoice[], active: Set<string>): PastChoice | null {
  const key = vendorKey(merchant);
  const mine = history.filter((h) => vendorKey(h.merchant) === key && active.has(h.bucketId)).sort((a, b) => b.date.localeCompare(a.date));
  return mine.find((h) => h.source === 'user') ?? mine.find((h) => h.source === 'ai') ?? null;
}

export function sortTransaction(
  tx: Pick<Transaction, 'merchant' | 'plaidCategory' | 'plaidDetailedCategory'>,
  rules: MerchantRule[],
  buckets: Pick<Bucket, 'id' | 'name' | 'archived'>[],
  history: PastChoice[] = [],
): SortResult {
  const base: CategorizeResult = categorize(tx, rules, buckets);
  if (base.source === 'rule') return { ...base, reason: 'Your rule', askAi: false };

  const active = new Set(buckets.filter((b) => !b.archived).map((b) => b.id));
  const past = learnedBucket(tx.merchant, history, active);
  if (past) {
    return past.source === 'user'
      ? { bucketId: past.bucketId, source: 'rule', reason: `Where you put ${tx.merchant.trim()} before`, askAi: false }
      : { bucketId: past.bucketId, source: 'ai', reason: `Sorted like earlier ${tx.merchant.trim()} purchases`, askAi: false };
  }

  const vague = !tx.plaidCategory || AMBIGUOUS.has(tx.plaidCategory) || base.bucketId === FALLBACK_BUCKET_ID;
  return { ...base, askAi: vague };
}

/** Claude's answer for a batch of purchases. */
export const AI_SORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['choices'],
  properties: {
    choices: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'bucket_id', 'reason'],
        properties: {
          id: { type: 'string', description: 'The purchase id from the input.' },
          bucket_id: { type: 'string', description: 'One of the bucket ids given.' },
          reason: { type: 'string', description: 'Why, in at most 8 words, e.g. "Coffee shop paid through Square".' },
        },
      },
    },
  },
} as const;

export const AI_SORT_SYSTEM = `You sort a family's card purchases into their budget buckets.
For each purchase pick the single best bucket id from the list given, using the store name,
Plaid's category and the amount. Store names are often abbreviated or prefixed by a payment
processor (SQ *, TST*, PAYPAL *, AMZN Mktp). Use the family's past choices as examples of how
they like things sorted. If nothing fits better, use the catch-all bucket. Keep each reason short
and plain, without restating the bucket name.`;

/** The facts sent to Claude for one batch. */
export function aiSortInput(
  purchases: (Pick<Transaction, 'id' | 'merchant' | 'amount' | 'plaidCategory' | 'plaidDetailedCategory'>)[],
  buckets: Pick<Bucket, 'id' | 'name' | 'archived'>[],
  examples: PastChoice[],
) {
  const name = (id: string) => buckets.find((b) => b.id === id)?.name ?? id;
  return {
    buckets: buckets.filter((b) => !b.archived).map((b) => ({ id: b.id, name: b.name, catch_all: b.id === FALLBACK_BUCKET_ID || undefined })),
    past_choices: [...new Map(examples.filter((e) => e.source === 'user' || e.source === 'rule').map((e) => [vendorKey(e.merchant), e])).values()]
      .slice(0, 30).map((e) => ({ store: e.merchant, bucket: name(e.bucketId) })),
    purchases: purchases.map((p) => ({
      id: p.id, store: p.merchant, amount: formatCents(p.amount),
      plaid_category: p.plaidDetailedCategory ?? p.plaidCategory ?? null,
    })),
  };
}

/** Keeps only answers that name a real purchase and a real, active bucket. */
export function acceptAiChoices(
  choices: { id: string; bucket_id: string; reason: string }[],
  purchaseIds: string[],
  buckets: Pick<Bucket, 'id' | 'archived'>[],
): Map<string, { bucketId: string; reason: string }> {
  const ids = new Set(purchaseIds);
  const active = new Set(buckets.filter((b) => !b.archived).map((b) => b.id));
  return new Map(choices.filter((c) => ids.has(c.id) && active.has(c.bucket_id))
    .map((c) => [c.id, { bucketId: c.bucket_id, reason: c.reason.trim().slice(0, 60) }]));
}
