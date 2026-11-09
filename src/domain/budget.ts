import type { Allocation, Bucket, Cents, Month, Transaction } from './types';
import { formatCents, monthOf } from './money';
import { bucketPace, textBar } from './pace';

export interface BucketStatus {
  bucket: Bucket;
  spent: Cents;
  remaining: Cents;
  /** 0..n, where 1 = exactly at the limit. */
  ratio: number;
  overBy: Cents;
}

export function bucketStatuses(
  buckets: Bucket[],
  transactions: Transaction[],
  allocations: Allocation[],
  month: Month,
): BucketStatus[] {
  const txMonth = new Map(transactions.map((t) => [t.id, monthOf(t.date)]));
  const spentBy = new Map<string, Cents>();
  for (const a of allocations) {
    if (txMonth.get(a.transactionId) !== month) continue;
    spentBy.set(a.bucketId, (spentBy.get(a.bucketId) ?? 0) + a.amount);
  }
  return buckets
    .filter((b) => !b.archived)
    .map((bucket) => {
      const spent = spentBy.get(bucket.id) ?? 0;
      const remaining = bucket.monthlyLimit - spent;
      return {
        bucket,
        spent,
        remaining,
        ratio: bucket.monthlyLimit > 0 ? spent / bucket.monthlyLimit : spent > 0 ? Infinity : 0,
        overBy: Math.max(0, -remaining),
      };
    });
}

/** The push notification shown when a new transaction is detected. */
export function transactionNotification(
  tx: Pick<Transaction, 'merchant' | 'amount' | 'pending'>,
  parts: { status: BucketStatus; amount: Cents }[],
  day: number,
  daysInMonth: number,
): { title: string; body: string; bucketId?: string } {
  const title = `${formatCents(tx.amount)} at ${tx.merchant}${tx.pending ? ' (pending)' : ''}`;
  const lines = parts.flatMap(({ status, amount }) => {
    const pace = bucketPace(status, day, daysInMonth);
    const prefix = parts.length > 1 ? `${formatCents(amount)} → ` : '';
    return [
      `${prefix}${status.bucket.name} · ${pace.label}`,
      `${textBar(status.ratio)} ${pace.percentUsed}% · ${formatCents(status.spent, { showCents: false })} of ${formatCents(status.bucket.monthlyLimit, { showCents: false })}`,
    ];
  });
  // Tapping opens the bucket the charge landed in (the biggest share for split purchases).
  const main = [...parts].sort((a, b) => b.amount - a.amount)[0];
  return { title, body: lines.join('\n'), bucketId: main?.status.bucket.id };
}
