import { categorize, daysInMonth, DEFAULT_BUCKETS, dollars, previousMonth, splitByReceipt, splitWays } from '@/src/domain';
import type { Account, Allocation, Bucket, Member, MerchantRule, SavingsGoal, SplitSettings, Transaction } from '@/src/domain';

/** Sample data so the app is usable in Expo Go before Plaid and the backend are connected. */
const now = new Date();
const month = now.toISOString().slice(0, 7);
// Keep sample dates in the past even early in the month.
const d = (day: number) => `${month}-${String(Math.min(day, now.getDate())).padStart(2, '0')}`;

// The signed-in user is 'me'. A sample partner shows how a second member's card appears.
export const demoMembers: Member[] = [
  { id: 'me', name: 'You', role: 'owner' },
  { id: 'partner', name: 'Sam', role: 'member' },
];

export const demoAccounts: Account[] = [
  { id: 'chk', name: 'Checking', institution: 'Bank of America', mask: '1234', ownerId: 'me' },
  { id: 'cc', name: 'Visa', institution: 'Chase', mask: '5678', ownerId: 'me' },
  { id: 'partner-cc', name: 'Visa', institution: 'Capital One', mask: '9012', ownerId: 'partner' },
];

export const demoBuckets: Bucket[] = DEFAULT_BUCKETS.map(({ plaidPrimary, ...b }) => b);

export const demoRules: MerchantRule[] = [{ match: 'costco', bucketId: 'groceries' }];

const thisMonthTransactions: Transaction[] = [
  { id: 't0', accountId: 'chk', merchant: 'Maple Court Apartments', amount: dollars(3000), date: d(1), pending: false, plaidCategory: 'RENT_AND_UTILITIES' },
  { id: 't1', accountId: 'partner-cc', merchant: 'Kroger', amount: dollars(184.12), date: d(2), pending: false, plaidCategory: 'FOOD_AND_DRINK', plaidDetailedCategory: 'FOOD_AND_DRINK_GROCERIES' },
  { id: 't2', accountId: 'cc', merchant: 'Target', amount: dollars(142.37), date: d(3), pending: false, plaidCategory: 'GENERAL_MERCHANDISE', plaidDetailedCategory: 'GENERAL_MERCHANDISE_SUPERSTORES' },
  { id: 't3', accountId: 'cc', merchant: 'Chipotle', amount: dollars(38.4), date: d(4), pending: false, plaidCategory: 'FOOD_AND_DRINK' },
  { id: 't4', accountId: 'chk', merchant: 'Shell', amount: dollars(52.1), date: d(5), pending: false, plaidCategory: 'TRANSPORTATION' },
  { id: 't5', accountId: 'partner-cc', merchant: 'Costco', amount: dollars(286.55), date: d(6), pending: false, plaidCategory: 'GENERAL_MERCHANDISE' },
  { id: 't6', accountId: 'cc', merchant: 'Olive Garden', amount: dollars(96.2), date: d(7), pending: false, plaidCategory: 'FOOD_AND_DRINK' },
  { id: 't7', accountId: 'cc', merchant: 'Netflix', amount: dollars(22.99), date: d(7), pending: false, plaidCategory: 'ENTERTAINMENT' },
  { id: 't9', accountId: 'cc', merchant: 'Adobe', amount: dollars(32.99), date: d(8), pending: false, plaidCategory: 'ENTERTAINMENT' },
  { id: 't10', accountId: 'cc', merchant: 'Spotify', amount: dollars(11.99), date: d(3), pending: false, plaidCategory: 'ENTERTAINMENT' },
  { id: 't11', accountId: 'partner-cc', merchant: 'Planet Fitness', amount: dollars(24.99), date: d(5), pending: false, plaidCategory: 'PERSONAL_CARE' },
  { id: 't12', accountId: 'cc', merchant: 'APPLE.COM/BILL', amount: dollars(2.99), date: d(6), pending: false, plaidCategory: 'GENERAL_SERVICES' },
  { id: 't13', accountId: 'partner-cc', merchant: 'SQ *BLUE BOTTLE COFFEE', amount: dollars(14.75), date: d(9), pending: true },
  { id: 't8', accountId: 'cc', merchant: 'DoorDash', amount: dollars(141.3), date: d(8), pending: true, plaidCategory: 'FOOD_AND_DRINK' },
];

// A full month of last month's spending, for the trend benchmark.
const prev = previousMonth(month);
const lastMonthPlan: [number, string, number, string][] = [
  [1, 'Kroger', 142.5, 'FOOD_AND_DRINK_GROCERIES'], [2, 'Shell', 48.2, ''], [3, 'Chipotle', 24.1, ''],
  [4, 'Netflix', 22.99, ''], [16, 'Adobe', 29.99, ''], [5, 'Home Depot', 86.4, ''], [7, 'Smiths', 96.3, 'FOOD_AND_DRINK_GROCERIES'],
  [8, 'Jersey Mikes', 15.8, ''], [9, 'Maverik', 52.6, ''], [11, 'Target', 118.9, ''], [12, 'Olive Garden', 74.2, ''],
  [14, 'Kroger', 131.75, 'FOOD_AND_DRINK_GROCERIES'], [15, 'Topgolf', 64, ''], [16, 'Chevron', 45.3, ''],
  [18, 'Amazon', 59.99, ''], [19, 'Dunkin', 9.4, ''], [21, 'Costco', 212.4, ''], [22, 'Cinemark', 31.5, ''],
  [24, 'Maverik', 49.9, ''], [25, 'DoorDash', 38.6, ''], [26, 'REI', 89.95, ''], [28, 'Kroger', 104.2, 'FOOD_AND_DRINK_GROCERIES'],
  [29, 'Shell', 51.1, ''], [30, 'Chipotle', 27.3, ''], [1, 'Maple Court Apartments', 3000, ''],
  [15, 'City Power & Light', 112.8, ''], [22, 'Verizon Wireless', 85, ''], [10, 'State Farm', 128, ''], [3, 'Spotify', 10.99, ''], [5, 'Planet Fitness', 24.99, ''], [6, 'APPLE.COM/BILL', 2.99, ''], [20, 'Disney Plus', 13.99, ''],
];
const plaidPrimary: Record<string, string> = {
  Shell: 'TRANSPORTATION', Maverik: 'TRANSPORTATION', Chevron: 'TRANSPORTATION', Chipotle: 'FOOD_AND_DRINK',
  'Jersey Mikes': 'FOOD_AND_DRINK', 'Olive Garden': 'FOOD_AND_DRINK', Dunkin: 'FOOD_AND_DRINK', DoorDash: 'FOOD_AND_DRINK',
  Netflix: 'ENTERTAINMENT', Adobe: 'ENTERTAINMENT', Topgolf: 'ENTERTAINMENT', Cinemark: 'ENTERTAINMENT', 'Home Depot': 'GENERAL_MERCHANDISE',
  Target: 'GENERAL_MERCHANDISE', Amazon: 'GENERAL_MERCHANDISE', REI: 'GENERAL_MERCHANDISE', Costco: 'GENERAL_MERCHANDISE',
  Kroger: 'FOOD_AND_DRINK', Smiths: 'FOOD_AND_DRINK', 'Maple Court Apartments': 'RENT_AND_UTILITIES',
  'City Power & Light': 'RENT_AND_UTILITIES', 'Verizon Wireless': 'RENT_AND_UTILITIES', 'State Farm': 'GENERAL_SERVICES', Spotify: 'ENTERTAINMENT', 'Planet Fitness': 'PERSONAL_CARE', 'APPLE.COM/BILL': 'GENERAL_SERVICES', 'Disney Plus': 'ENTERTAINMENT',
};
const lastMonthTransactions: Transaction[] = lastMonthPlan
  .filter(([day]) => day <= daysInMonth(prev))
  .map(([day, merchant, amount, detailed], i) => ({
    id: `p${i}`, accountId: 'cc', merchant, amount: dollars(amount), pending: false,
    date: `${prev}-${String(day).padStart(2, '0')}`,
    plaidCategory: plaidPrimary[merchant], plaidDetailedCategory: detailed || undefined,
  }));

// Two older months, so bills, trends and budget tune-ups have a pattern to go on. Dining out
// was lighter back then, so last month shows up as a rise.
const billsPlan: [number, string, number][] = [
  [1, 'Maple Court Apartments', 3000], [15, 'City Power & Light', 96.4], [22, 'Verizon Wireless', 85], [10, 'State Farm', 128],
  [4, 'Netflix', 22.99], [16, 'Adobe', 29.99], [3, 'Spotify', 10.99], [5, 'Planet Fitness', 24.99], [6, 'APPLE.COM/BILL', 2.99],
];
const isBillName = new Set(billsPlan.map(([, m]) => m));
const DINING = new Set(['Chipotle', 'Olive Garden', 'Jersey Mikes', 'DoorDash', 'Dunkin']);
const olderTransactions: Transaction[] = [previousMonth(prev), previousMonth(previousMonth(prev))].flatMap((m, k) => {
  const everyday = lastMonthPlan
    .filter(([day, merchant]) => !isBillName.has(merchant) && day <= daysInMonth(m))
    .map(([day, merchant, amount]) => [day, merchant, Math.round(amount * (DINING.has(merchant) ? 0.55 : k ? 1.04 : 0.93) * 100) / 100] as [number, string, number]);
  return [...billsPlan, ...everyday].map(([day, merchant, amount], i) => ({
    id: `q${k}-${i}`, accountId: merchant === 'Maple Court Apartments' ? 'chk' : 'cc', merchant, amount: dollars(amount), pending: false,
    date: `${m}-${String(day).padStart(2, '0')}`, plaidCategory: plaidPrimary[merchant],
    plaidDetailedCategory: lastMonthPlan.find(([, n, , d]) => n === merchant && d)?.[3] || undefined,
  }));
});

export const demoTransactions: Transaction[] = [...thisMonthTransactions, ...lastMonthTransactions, ...olderTransactions];

// The Target trip was receipt-scanned and split between groceries and kids.
const targetSplit = splitByReceipt('t2', dollars(142.37), [
  { description: 'Groceries', amount: dollars(92.19), bucketId: 'groceries' },
  { description: 'LEGO Classic set', amount: dollars(39.99), bucketId: 'kids' },
]);

// The coffee purchase had no category from the bank, so the AI sorted it.
const aiSorted: Record<string, Pick<Allocation, 'bucketId' | 'reason'>> = {
  t13: { bucketId: 'dining', reason: 'Coffee shop paid through Square' },
};

export const demoAllocations: Allocation[] = demoTransactions.flatMap((t) =>
  t.id === 't2' ? targetSplit
    : aiSorted[t.id] ? [{ transactionId: t.id, amount: t.amount, source: 'ai' as const, ...aiSorted[t.id] }]
    : [{ transactionId: t.id, bucketId: categorize(t, demoRules, demoBuckets).bucketId, amount: t.amount, source: 'auto' as const }],
);

export const demoGoals: SavingsGoal[] = [
  { id: 'emergency', name: 'Emergency Fund', target: dollars(10000), balance: dollars(4200), monthlyContribution: dollars(300), priority: 1 },
  { id: 'vacation', name: 'Summer Vacation', target: dollars(3000), balance: dollars(850), monthlyContribution: dollars(250), priority: 2, targetDate: '2027-06-01' },
  { id: 'christmas', name: 'Christmas', target: dollars(1200), balance: dollars(600), monthlyContribution: dollars(100), priority: 3, targetDate: '2026-12-15' },
];

// Rent is shared three ways with roommates outside the app, so only a third counts.
export const demoSplits: SplitSettings = { byTransaction: {}, byVendor: { 'maple court apartments': splitWays(3) } };
