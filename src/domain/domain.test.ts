import { describe, expect, it } from 'vitest';
import {
  bucketStatuses, categorize, DEFAULT_BUCKETS, dollars, overspendImpact, splitByReceipt,
  transactionNotification, type Allocation, type Bucket, type SavingsGoal, type Transaction,
} from './index';

const buckets: Bucket[] = DEFAULT_BUCKETS.map(({ plaidPrimary, ...b }) => b);

describe('categorize', () => {
  it('uses Plaid detailed category for groceries', () => {
    expect(categorize({ merchant: 'Kroger', plaidCategory: 'FOOD_AND_DRINK', plaidDetailedCategory: 'FOOD_AND_DRINK_GROCERIES' }, [], buckets))
      .toEqual({ bucketId: 'groceries', source: 'auto' });
  });
  it('lets merchant rules win, longest match first', () => {
    const rules = [{ match: 'target', bucketId: 'groceries' }, { match: 'target optical', bucketId: 'health' }];
    expect(categorize({ merchant: 'TARGET OPTICAL #12' }, rules, buckets).bucketId).toBe('health');
    expect(categorize({ merchant: 'Target T-1234' }, rules, buckets).bucketId).toBe('groceries');
  });
  it('falls back to Everything Else', () => {
    expect(categorize({ merchant: '???' }, [], buckets).bucketId).toBe('other');
  });
});

describe('splitByReceipt', () => {
  it('spreads tax proportionally and sums exactly to the bank amount', () => {
    const allocs = splitByReceipt('t1', dollars(142.37), [
      { description: 'Milk', amount: dollars(4.29), bucketId: 'groceries' },
      { description: 'Bread', amount: dollars(3.5), bucketId: 'groceries' },
      { description: 'LEGO set', amount: dollars(39.99), bucketId: 'kids' },
      { description: 'Produce', amount: dollars(84.4), bucketId: 'groceries' },
    ]);
    expect(allocs.reduce((s, a) => s + a.amount, 0)).toBe(dollars(142.37));
    expect(allocs.map((a) => a.bucketId).sort()).toEqual(['groceries', 'kids']);
    const kids = allocs.find((a) => a.bucketId === 'kids')!;
    expect(kids.amount).toBeGreaterThan(dollars(39.99)); // includes its share of tax
  });
  it('handles coupons that make items exceed the charge', () => {
    const allocs = splitByReceipt('t2', 1000, [
      { description: 'a', amount: 700, bucketId: 'a' },
      { description: 'b', amount: 700, bucketId: 'b' },
    ]);
    expect(allocs.map((a) => a.amount)).toEqual([500, 500]);
  });
  it('rejects an empty receipt', () => {
    expect(() => splitByReceipt('t', 100, [])).toThrow();
  });
});

const tx = (id: string, amount: number, date = '2026-11-05'): Transaction =>
  ({ id, accountId: 'a', merchant: 'm', amount: dollars(amount), date, pending: false });

describe('bucketStatuses + notification', () => {
  it('sums only the current month and builds the notification text', () => {
    const txs = [tx('1', 600), tx('2', 100, '2026-10-30'), tx('3', 84.12)];
    const allocs: Allocation[] = [
      { transactionId: '1', bucketId: 'groceries', amount: dollars(600), source: 'auto' },
      { transactionId: '2', bucketId: 'groceries', amount: dollars(100), source: 'auto' },
      { transactionId: '3', bucketId: 'groceries', amount: dollars(84.12), source: 'auto' },
    ];
    const s = bucketStatuses(buckets, txs, allocs, '2026-11').find((b) => b.bucket.id === 'groceries')!;
    expect(s.spent).toBe(dollars(684.12));
    const n = transactionNotification({ merchant: 'Kroger', amount: dollars(84.12), pending: true }, [{ status: s, amount: dollars(84.12) }]);
    expect(n.title).toBe('$84.12 at Kroger (pending)');
    expect(n.body).toBe('Groceries: $684 of $700 (98%) · $15 left');
  });
});

describe('overspendImpact', () => {
  const goals: SavingsGoal[] = [
    { id: 'em', name: 'Emergency', target: dollars(10000), balance: dollars(4000), monthlyContribution: dollars(300), priority: 1 },
    { id: 'vac', name: 'Vacation', target: dollars(3000), balance: dollars(150), monthlyContribution: dollars(100), priority: 2 },
  ];
  const status = (limit: number, spent: number) => {
    const b = { ...buckets[0], monthlyLimit: dollars(limit) };
    const remaining = b.monthlyLimit - dollars(spent);
    return { bucket: b, spent: dollars(spent), remaining, ratio: spent / limit, overBy: Math.max(0, -remaining) };
  };

  it('uses slack in other buckets before savings', () => {
    const r = overspendImpact([status(100, 150), status(100, 20)], goals);
    expect(r.totalOverspend).toBe(dollars(50));
    expect(r.hitsSavings).toBe(0);
  });
  it('draws from least-protected goal first and reports delay', () => {
    const r = overspendImpact([status(100, 300)], goals, { useOtherBucketSlack: false });
    const vac = r.goals.find((g) => g.goal.id === 'vac')!;
    const em = r.goals.find((g) => g.goal.id === 'em')!;
    expect(vac.drawn).toBe(dollars(150));
    expect(vac.monthsDelayed).toBe(2);
    expect(em.drawn).toBe(dollars(50));
    expect(r.uncovered).toBe(0);
  });
});
