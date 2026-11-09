import { categorize, DEFAULT_BUCKETS, dollars, splitByReceipt } from '@/src/domain';
import type { Allocation, Bucket, MerchantRule, SavingsGoal, Transaction } from '@/src/domain';

/** Sample data so the app is usable in Expo Go before Plaid and the backend are connected. */
const month = new Date().toISOString().slice(0, 7);
const d = (day: number) => `${month}-${String(day).padStart(2, '0')}`;

export const demoBuckets: Bucket[] = DEFAULT_BUCKETS.map(({ plaidPrimary, ...b }) => b);

export const demoRules: MerchantRule[] = [{ match: 'costco', bucketId: 'groceries' }];

export const demoTransactions: Transaction[] = [
  { id: 't1', accountId: 'chk', merchant: 'Kroger', amount: dollars(184.12), date: d(2), pending: false, plaidCategory: 'FOOD_AND_DRINK', plaidDetailedCategory: 'FOOD_AND_DRINK_GROCERIES' },
  { id: 't2', accountId: 'cc', merchant: 'Target', amount: dollars(142.37), date: d(3), pending: false, plaidCategory: 'GENERAL_MERCHANDISE', plaidDetailedCategory: 'GENERAL_MERCHANDISE_SUPERSTORES' },
  { id: 't3', accountId: 'cc', merchant: 'Chipotle', amount: dollars(38.4), date: d(4), pending: false, plaidCategory: 'FOOD_AND_DRINK' },
  { id: 't4', accountId: 'chk', merchant: 'Shell', amount: dollars(52.1), date: d(5), pending: false, plaidCategory: 'TRANSPORTATION' },
  { id: 't5', accountId: 'cc', merchant: 'Costco', amount: dollars(286.55), date: d(6), pending: false, plaidCategory: 'GENERAL_MERCHANDISE' },
  { id: 't6', accountId: 'cc', merchant: 'Olive Garden', amount: dollars(96.2), date: d(7), pending: false, plaidCategory: 'FOOD_AND_DRINK' },
  { id: 't7', accountId: 'cc', merchant: 'Netflix', amount: dollars(22.99), date: d(7), pending: false, plaidCategory: 'ENTERTAINMENT' },
  { id: 't8', accountId: 'cc', merchant: 'DoorDash', amount: dollars(141.3), date: d(8), pending: true, plaidCategory: 'FOOD_AND_DRINK' },
];

// The Target trip was receipt-scanned and split between groceries and kids.
const targetSplit = splitByReceipt('t2', dollars(142.37), [
  { description: 'Groceries', amount: dollars(92.19), bucketId: 'groceries' },
  { description: 'LEGO Classic set', amount: dollars(39.99), bucketId: 'kids' },
]);

export const demoAllocations: Allocation[] = demoTransactions.flatMap((t) =>
  t.id === 't2' ? targetSplit : [{ transactionId: t.id, bucketId: categorize(t, demoRules, demoBuckets).bucketId, amount: t.amount, source: 'auto' as const }],
);

export const demoGoals: SavingsGoal[] = [
  { id: 'emergency', name: 'Emergency Fund', target: dollars(10000), balance: dollars(4200), monthlyContribution: dollars(300), priority: 1 },
  { id: 'vacation', name: 'Summer Vacation', target: dollars(3000), balance: dollars(850), monthlyContribution: dollars(250), priority: 2, targetDate: '2027-06-01' },
  { id: 'christmas', name: 'Christmas', target: dollars(1200), balance: dollars(600), monthlyContribution: dollars(100), priority: 3, targetDate: '2026-12-15' },
];
