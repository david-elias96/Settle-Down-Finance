import type { Allocation, Cents } from './types';

export interface ReceiptLine {
  description: string;
  amount: Cents;
  bucketId: string;
}

/**
 * Splits a bank transaction across buckets using receipt line items.
 *
 * Receipt item prices rarely add up to the bank amount (tax, coupons, rounding),
 * so the difference is spread across buckets in proportion to their item totals.
 * Uses largest-remainder rounding so the allocations sum to exactly `total`.
 */
export function splitByReceipt(transactionId: string, total: Cents, lines: ReceiptLine[]): Allocation[] {
  const byBucket = new Map<string, Cents>();
  for (const l of lines) byBucket.set(l.bucketId, (byBucket.get(l.bucketId) ?? 0) + l.amount);

  const entries = [...byBucket.entries()].filter(([, v]) => v !== 0);
  const itemsTotal = entries.reduce((s, [, v]) => s + v, 0);
  if (entries.length === 0 || itemsTotal === 0) {
    throw new Error('Receipt has no priced items to split by');
  }

  const raw = entries.map(([bucketId, v]) => ({ bucketId, exact: (v / itemsTotal) * total }));
  const floored = raw.map((r) => ({ ...r, amount: Math.floor(r.exact) }));
  let leftover = total - floored.reduce((s, r) => s + r.amount, 0);
  const order = [...floored].sort((a, b) => (b.exact - b.amount) - (a.exact - a.amount));
  for (let i = 0; leftover > 0; i = (i + 1) % order.length, leftover--) order[i].amount += 1;

  return floored.map((r) => ({ transactionId, bucketId: r.bucketId, amount: r.amount, source: 'receipt' as const }));
}
