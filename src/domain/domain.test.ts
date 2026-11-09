import { describe, expect, it } from 'vitest';
import {
  bucketStatuses, categorize, creditsLeft, creditsResetLabel, spendCredits, type CreditState, DEFAULT_BUCKETS, dollars, overspendImpact, splitByReceipt,
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
    const n = transactionNotification({ merchant: 'Kroger', amount: dollars(84.12), pending: true }, [{ status: s, amount: dollars(84.12) }], 9, 30);
    expect(n.title).toBe('$84.12 at Kroger (pending)');
    expect(n.body).toBe('Groceries · Over pace\n▰▰▰▰▰▰▰▰▰▱ 98% · $684 of $700');
    expect(n.bucketId).toBe('groceries');
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

import { compareToLastMonth, cumulativeSpend, isBudgetSpending, previousMonth } from './index';

describe('isBudgetSpending', () => {
  it('excludes card payments, transfers and income', () => {
    expect(isBudgetSpending({ plaidCategory: 'LOAN_PAYMENTS', plaidDetailedCategory: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' })).toBe(false);
    expect(isBudgetSpending({ plaidCategory: 'TRANSFER_OUT' })).toBe(false);
    expect(isBudgetSpending({ plaidCategory: 'INCOME' })).toBe(false);
    expect(isBudgetSpending({ plaidCategory: 'LOAN_PAYMENTS', plaidDetailedCategory: 'LOAN_PAYMENTS_CAR_PAYMENT' })).toBe(true);
    expect(isBudgetSpending({ plaidCategory: 'FOOD_AND_DRINK' })).toBe(true);
  });
});

describe('spending trend', () => {
  const txs = [
    { id: 'a', date: '2026-10-02' }, { id: 'b', date: '2026-10-20' },
    { id: 'c', date: '2026-11-01' }, { id: 'd', date: '2026-11-03' }, { id: 'e', date: '2026-11-09' },
  ];
  const al = (transactionId: string, amount: number, bucketId = 'x'): Allocation => ({ transactionId, bucketId, amount, source: 'auto' });
  const allocs = [al('a', 1000), al('b', 5000), al('c', 200), al('d', 300), al('d', 100, 'y'), al('e', -50)];

  it('builds a running total per day, counting splits and refunds', () => {
    const pts = cumulativeSpend(txs, allocs, '2026-11', 9);
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ day: 1, cumulative: 200 });
    expect(pts[2].cumulative).toBe(600);
    expect(pts[8].cumulative).toBe(550);
  });
  it('compares with last month at the same day', () => {
    const c = compareToLastMonth(txs, allocs, '2026-11', 9);
    expect(c.previous).toHaveLength(31);
    expect(c.previousByThisDay).toBe(1000);
    expect(c.difference).toBe(550 - 1000);
    expect(c.previousTotal).toBe(6000);
  });
  it('handles year boundaries and short months', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    const c = compareToLastMonth([{ id: 'f', date: '2026-02-28' }], [al('f', 700)], '2026-03', 31);
    expect(c.previousByThisDay).toBe(700);
  });
});

import { bucketPace, textBar } from './index';

describe('bucketPace', () => {
  const st = (limit: number, spent: number) => {
    const bucket = { ...buckets[1], monthlyLimit: dollars(limit) };
    const remaining = bucket.monthlyLimit - dollars(spent);
    return { bucket, spent: dollars(spent), remaining, ratio: spent / limit, overBy: Math.max(0, -remaining) };
  };
  it('is on track near an even pace', () => {
    const p = bucketPace(st(300, 95), 10, 30); // even pace = $100
    expect(p.status).toBe('on_track');
    expect(p.percentUsed).toBe(32);
    expect(p.expectedByToday).toBe(dollars(100));
  });
  it('flags spending ahead of pace with a projection', () => {
    const p = bucketPace(st(300, 150), 10, 30);
    expect(p.status).toBe('over');
    expect(p.label).toBe('Over pace');
    expect(p.projectedTotal).toBe(dollars(450));
  });
  it('flags under pace', () => {
    expect(bucketPace(st(300, 40), 10, 30).status).toBe('under');
  });
  it('over budget wins regardless of pace', () => {
    const p = bucketPace(st(300, 320), 29, 30);
    expect(p.label).toBe('Over budget');
    expect(p.detail).toContain('$20.00 over');
  });
  it('draws a text bar', () => {
    expect(textBar(0.73)).toBe('▰▰▰▰▰▰▰▱▱▱');
    expect(textBar(1.4)).toBe('▰▰▰▰▰▰▰▰▰▰');
  });
});

import { filterTransactions, monthOptions, vendorKey, vendorOptions } from './index';

describe('transaction filters', () => {
  const tx = (id: string, merchant: string, amount: number, date: string): Transaction =>
    ({ id, merchant, amount: dollars(amount), date, accountId: 'a', pending: false });
  const txs = [
    tx('1', 'Target', 142.37, '2026-11-03'), tx('2', 'TARGET ', 20, '2026-10-12'),
    tx('3', 'Kroger', 80, '2026-11-02'), tx('4', 'Shell', 40, '2026-10-05'),
  ];
  const allocs: Allocation[] = [
    { transactionId: '1', bucketId: 'groceries', amount: dollars(99.3), source: 'receipt' },
    { transactionId: '1', bucketId: 'kids', amount: dollars(43.07), source: 'receipt' },
    { transactionId: '2', bucketId: 'shopping', amount: dollars(20), source: 'auto' },
    { transactionId: '3', bucketId: 'groceries', amount: dollars(80), source: 'auto' },
    { transactionId: '4', bucketId: 'transport', amount: dollars(40), source: 'auto' },
  ];

  it('filters by month', () => {
    const r = filterTransactions(txs, allocs, { month: '2026-11', bucketId: null, vendor: null });
    expect(r.items.map((i) => i.tx.id)).toEqual(['1', '3']);
    expect(r.total).toBe(dollars(222.37));
  });
  it('counts only the bucket share of split purchases', () => {
    const r = filterTransactions(txs, allocs, { month: null, bucketId: 'groceries', vendor: null });
    expect(r.items.map((i) => i.tx.id)).toEqual(['1', '3']);
    expect(r.total).toBe(dollars(179.3));
  });
  it('groups vendor spellings and combines filters', () => {
    const r = filterTransactions(txs, allocs, { month: null, bucketId: null, vendor: vendorKey('target') });
    expect(r.items).toHaveLength(2);
    expect(filterTransactions(txs, allocs, { month: '2026-10', bucketId: null, vendor: 'target' }).items.map((i) => i.tx.id)).toEqual(['2']);
  });
  it('builds vendor and month lists from the data', () => {
    const v = vendorOptions(txs);
    expect(v[0]).toMatchObject({ value: 'target', label: 'Target', count: 2 });
    expect(v.map((o) => o.value)).toEqual(['target', 'kroger', 'shell']);
    expect(monthOptions(txs).map((o) => o.value)).toEqual(['2026-11', '2026-10']);
  });
});

import { findInsights, findSubscriptions, waysToCut } from './index';

describe('insights', () => {
  const mk = (id: string, merchant: string, amount: number, date: string): Transaction =>
    ({ id, merchant, amount: dollars(amount), date, accountId: 'a', pending: false });
  const txs = [
    mk('n1', 'Netflix', 22.99, '2026-10-07'), mk('n2', 'Netflix', 22.99, '2026-11-07'),
    mk('a1', 'Adobe', 29.99, '2026-10-16'), mk('a2', 'Adobe', 32.99, '2026-11-08'),
    mk('k1', 'Kroger', 100, '2026-10-02'), mk('k2', 'Kroger', 90, '2026-10-20'),
    mk('d1', 'DoorDash', 38.6, '2026-10-25'), mk('d2', 'DoorDash', 141.3, '2026-11-08'),
  ];
  const allocs: Allocation[] = txs.map((t) => ({
    transactionId: t.id, amount: t.amount, source: 'auto',
    bucketId: t.merchant === 'DoorDash' ? 'dining' : t.merchant === 'Kroger' ? 'groceries' : 'entertainment',
  }));
  const status = (id: string, limit: number, spent: number) => {
    const bucket = { id, name: id[0].toUpperCase() + id.slice(1), icon: '', monthlyLimit: dollars(limit), isCustom: false };
    const remaining = bucket.monthlyLimit - dollars(spent);
    return { bucket, spent: dollars(spent), remaining, ratio: spent / limit, overBy: Math.max(0, -remaining) };
  };
  const input = {
    month: '2026-11', today: 9, daysInMonth: 30, transactions: txs, allocations: allocs,
    statuses: [status('dining', 250, 141.3), status('entertainment', 120, 55.98), status('groceries', 700, 0)],
  };

  it('finds subscriptions but not repeat grocery runs', () => {
    expect(findSubscriptions(txs).map((s) => s.vendor).sort()).toEqual(['Adobe', 'Netflix']);
  });
  it('flags overspend risk, unusual vendors and price increases', () => {
    const kinds = findInsights(input).map((i) => `${i.kind}:${i.bucketId ?? i.vendor}`);
    expect(kinds).toContain('overspend_risk:dining');
    expect(kinds).toContain('unusual_vendor:DoorDash');
    expect(kinds).toContain('subscription_change:Adobe');
    expect(kinds).not.toContain('unusual_vendor:Netflix');
  });
  it('suggests ways to cut, biggest saving first', () => {
    const ideas = waysToCut(input, (id) => id);
    expect(ideas[0].title).toBe('Slow down on Dining');
    expect(ideas.some((i) => i.title.startsWith('Review 2 subscriptions'))).toBe(true);
  });
});

describe('credits', () => {
  const start: CreditState = { period: '2026-11', allowance: 40, usedThisMonth: 39, extra: 2 };

  it('uses the monthly allowance before purchased credits', () => {
    const a = spendCredits(start, '2026-11', 1)!;
    expect(creditsLeft(a, '2026-11')).toEqual({ monthly: 0, extra: 2, total: 2 });
    const b = spendCredits(a, '2026-11', 1)!;
    expect(creditsLeft(b, '2026-11')).toEqual({ monthly: 0, extra: 1, total: 1 });
  });

  it('refuses when out of credits', () => {
    expect(spendCredits({ ...start, usedThisMonth: 40, extra: 0 }, '2026-11', 1)).toBeNull();
  });

  it('resets the allowance in a new month but keeps purchased credits', () => {
    const s = { ...start, usedThisMonth: 40 };
    expect(creditsLeft(s, '2026-12')).toEqual({ monthly: 40, extra: 2, total: 42 });
    expect(spendCredits(s, '2026-12', 1)).toEqual({ period: '2026-12', allowance: 40, usedThisMonth: 1, extra: 2 });
  });

  it('labels the reset date', () => {
    expect(creditsResetLabel('2026-11')).toBe('Dec 1');
    expect(creditsResetLabel('2026-12')).toBe('Jan 1');
  });
});
