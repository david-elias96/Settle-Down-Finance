import type { BucketStatus } from './budget.ts';
import { cancelRoute } from './cancelAgent.ts';
import { vendorKey } from './filters.ts';
import { formatCents } from './money.ts';
import { bucketPace, weeklyAllowance } from './pace.ts';
import type { Allocation, Cents, Month, Transaction } from './types.ts';

/**
 * Spending insights are found by plain code so the numbers are always exact.
 * The backend asks Claude only to choose which ones matter and to word them.
 */
export type InsightKind = 'month_projection' | 'over_budget' | 'overspend_risk' | 'unusual_vendor' | 'subscription_change' | 'under_budget';

export interface Insight {
  /** Stable id so the same insight isn't sent twice in a month. */
  id: string;
  kind: InsightKind;
  /** 3 = act now, 2 = worth knowing, 1 = nice to know. */
  priority: 1 | 2 | 3;
  title: string;
  body: string;
  bucketId?: string;
  vendor?: string;
  amount?: Cents;
  /** Short pieces for the Insights card, so it can be laid out instead of shown as a sentence. */
  card: InsightCard;
}

export interface InsightCard {
  /** What it's about: a bucket, a store, or "This month". */
  label: string;
  /** Status tag, 1-3 words: "Over budget", "Heading over". */
  tag: string;
  /** The key number: "$275 / $250", "$2,373". */
  figure: string;
  /** One short line of context. */
  note: string;
  tone: 'good' | 'warn' | 'bad';
  /** For a projection: the likely range, with an optional reference point such as last month's total. */
  range?: { low: Cents; mid: Cents; high: Cents; marker?: Cents; markerLabel?: string };
}

export interface InsightInput {
  month: Month;
  today: number;
  daysInMonth: number;
  statuses: BucketStatus[];
  transactions: Transaction[];
  allocations: Allocation[];
}

const short = (c: Cents) => formatCents(c, { showCents: false });

/** Buckets that are optional spending, where cutting back is realistic. */
export const DISCRETIONARY = new Set(['dining', 'entertainment', 'shopping', 'personal', 'other', 'kids']);

export function findInsights(input: InsightInput): Insight[] {
  return [
    ...budgetInsights(input),
    ...unusualVendorInsights(input),
    ...subscriptionInsights(input),
  ].sort((a, b) => b.priority - a.priority || (b.amount ?? 0) - (a.amount ?? 0));
}

function budgetInsights({ month, today, daysInMonth, statuses }: InsightInput): Insight[] {
  const out: Insight[] = [];
  for (const s of statuses) {
    if (s.bucket.monthlyLimit <= 0) continue;
    const pace = bucketPace(s, today, daysInMonth);
    if (s.overBy > 0) {
      out.push({
        id: `${month}:over:${s.bucket.id}`, kind: 'over_budget', priority: 3, bucketId: s.bucket.id, amount: s.overBy,
        title: `${s.bucket.name} is over budget`,
        body: `${formatCents(s.overBy)} over the ${short(s.bucket.monthlyLimit)} limit with ${daysInMonth - today} days left.`,
        card: { label: s.bucket.name, tag: 'Over budget', figure: `${short(s.spent)} / ${short(s.bucket.monthlyLimit)}`,
          note: `${short(s.overBy)} over · ${daysInMonth - today} days left`, tone: 'bad' },
      });
    } else if (pace.label === 'Over pace' && pace.projectedTotal > s.bucket.monthlyLimit) {
      const over = pace.projectedTotal - s.bucket.monthlyLimit;
      out.push({
        id: `${month}:risk:${s.bucket.id}`, kind: 'overspend_risk', priority: over > s.bucket.monthlyLimit * 0.25 ? 3 : 2,
        bucketId: s.bucket.id, amount: over,
        title: `${s.bucket.name} is on pace to go over`,
        body: `At this rate it ends the month near ${short(pace.projectedTotal)}, about ${short(over)} over. ${short(s.remaining)} left for ${daysInMonth - today} days.`,
        card: { label: s.bucket.name, tag: 'Heading over', figure: `${short(s.spent)} / ${short(s.bucket.monthlyLimit)}`,
          note: `On pace for ${short(pace.projectedTotal)} · ${short(s.remaining)} left`, tone: 'warn' },
      });
    }
  }
  // Late in the month with room to spare: suggest moving it to savings.
  const left = statuses.reduce((sum, s) => sum + Math.max(0, s.remaining), 0)
    - statuses.reduce((sum, s) => sum + s.overBy, 0);
  if (daysInMonth - today <= 5 && left >= 5000) {
    out.push({
      id: `${month}:under`, kind: 'under_budget', priority: 1, amount: left,
      title: `${short(left)} under budget`,
      body: `With ${daysInMonth - today} days left you're ${short(left)} under budget overall. Move some to a savings goal?`,
      card: { label: 'Whole budget', tag: 'Under budget', figure: `${short(left)} left`, note: 'Move some to a savings goal?', tone: 'good' },
    });
  }
  return out;
}

/** Month-to-date spend per vendor compared with that vendor's average in earlier months. */
function unusualVendorInsights({ month, transactions }: InsightInput): Insight[] {
  const byVendorMonth = new Map<string, Map<Month, Cents>>();
  const label = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    // Monthly shopping trips (Target, Costco, gas) aren't subscriptions, unless it's a
    // known subscription service billed under a shopping category.
    if (tx.plaidCategory && SHOPPING.has(tx.plaidCategory) && !cancelRoute(tx.merchant)) continue;
    // Rent, utilities and loan payments repeat monthly too, but they're bills, not subscriptions.
    if (tx.plaidCategory === 'RENT_AND_UTILITIES' || tx.plaidCategory === 'LOAN_PAYMENTS') continue;
    const v = vendorKey(tx.merchant);
    label.set(v, tx.merchant.trim());
    const m = byVendorMonth.get(v) ?? new Map();
    m.set(tx.date.slice(0, 7), (m.get(tx.date.slice(0, 7)) ?? 0) + tx.amount);
    byVendorMonth.set(v, m);
  }
  const priorMonths = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].filter((m) => m < month);
  if (!priorMonths.length) return [];

  const out: Insight[] = [];
  for (const [v, months] of byVendorMonth) {
    const now = months.get(month) ?? 0;
    const avg = priorMonths.reduce((s, m) => s + (months.get(m) ?? 0), 0) / priorMonths.length;
    if (avg <= 0) continue; // brand-new vendors aren't "unusual" yet
    if (now >= 4000 && now > avg * 1.5 && now - avg >= 5000) {
      out.push({
        id: `${month}:vendor:${v}`, kind: 'unusual_vendor', priority: 2, vendor: label.get(v), amount: Math.round(now - avg),
        title: `More than usual at ${label.get(v)}`,
        body: `${short(now)} so far this month, compared with about ${short(avg)} in a typical month.`,
        card: { label: label.get(v)!, tag: 'More than usual', figure: short(now), note: `Usually about ${short(avg)} a month`, tone: 'warn' },
      });
    }
  }
  return out;
}

export interface Subscription {
  vendor: string;
  amount: Cents;
  previousAmount: Cents;
  lastDate: string;
  /** First charge seen and how many monthly charges so far, for "since Mar · $180 so far". */
  firstDate: string;
  charges: number;
  paidSoFar: Cents;
  /** When the next charge is expected: the same day next month. */
  nextDate: string;
}

/** The same day next month, clamped to the month's length ("2026-01-31" → "2026-02-28"). */
export function nextMonthlyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y; const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** The next charge on or after `today` ("YYYY-MM-DD"), stepping a monthly date forward from `from`. */
export function nextChargeOnOrAfter(from: string, today: string): string {
  let next = nextMonthlyDate(from);
  // A charge that should have come already (late, or not posted yet) is expected next month.
  for (let i = 0; next < today && i < 120; i++) next = nextMonthlyDate(next);
  return next;
}

/** Plaid categories for bills: housing, utilities, phone and internet, loans. */
const BILL_CATEGORIES = new Set(['RENT_AND_UTILITIES', 'LOAN_PAYMENTS']);
/** Bills Plaid files elsewhere (insurance under general services, phone plans, utilities, rent). */
const BILL_NAMES = /insurance|state farm|geico|progressive|allstate|liberty mutual|nationwide|farmers ins|usaa|mortgage|apartments|\brent\b|property management|power|electric|energy|water|utilit|gas co|verizon|at&t|t-mobile|sprint|comcast|xfinity|spectrum|\bcox\b/i;

/**
 * A bill rather than a subscription: rent, utilities, phone, insurance, loans. These repeat
 * monthly too, but people don't cancel them from a budgeting app, so they never get a Cancel.
 */
export function isBill(tx: Pick<Transaction, 'merchant' | 'plaidCategory'>): boolean {
  if (tx.plaidCategory && (BILL_CATEGORIES.has(tx.plaidCategory) || tx.plaidCategory.includes('INSURANCE'))) return true;
  return BILL_NAMES.test(tx.merchant);
}

/**
 * Charges from the same vendor in consecutive months at a similar amount (within 15%). Shopping categories are skipped.
 * One charge per month at most, so groceries and gas aren't mistaken for subscriptions. With
 * `today`, the next charge date is never in the past.
 */
export function findSubscriptions(transactions: Transaction[], today?: string): Subscription[] {
  const byVendor = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    // Monthly shopping trips (Target, Costco, gas) aren't subscriptions, unless it's a
    // known subscription service billed under a shopping category.
    if (tx.plaidCategory && SHOPPING.has(tx.plaidCategory) && !cancelRoute(tx.merchant)) continue;
    // Rent, utilities, phone, insurance and loans repeat monthly too, but they're bills, not subscriptions.
    if (isBill(tx)) continue;
    const v = vendorKey(tx.merchant);
    byVendor.set(v, [...(byVendor.get(v) ?? []), tx]);
  }
  const subs: Subscription[] = [];
  for (const txs of byVendor.values()) {
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const months = sorted.map((t) => t.date.slice(0, 7));
    if (new Set(months).size !== months.length || sorted.length < 2) continue;
    const [prev, last] = sorted.slice(-2);
    const gapMonths = monthIndex(last.date) - monthIndex(prev.date);
    if (gapMonths !== 1) continue;
    if (Math.abs(last.amount - prev.amount) > prev.amount * 0.15) continue;
    // Count back through the unbroken run of monthly charges.
    let start = sorted.length - 1;
    while (start > 0 && monthIndex(sorted[start].date) - monthIndex(sorted[start - 1].date) === 1) start--;
    const run = sorted.slice(start);
    subs.push({
      vendor: last.merchant.trim(), amount: last.amount, previousAmount: prev.amount, lastDate: last.date,
      firstDate: run[0].date, charges: run.length, paidSoFar: run.reduce((s, t) => s + t.amount, 0), nextDate: today ? nextChargeOnOrAfter(last.date, today) : nextMonthlyDate(last.date),
    });
  }
  return subs.sort((a, b) => b.amount - a.amount);
}

const SHOPPING = new Set(['GENERAL_MERCHANDISE', 'FOOD_AND_DRINK', 'TRANSPORTATION', 'TRAVEL', 'HOME_IMPROVEMENT', 'PERSONAL_CARE']);

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

function subscriptionInsights({ month, transactions }: InsightInput): Insight[] {
  return findSubscriptions(transactions)
    .filter((s) => s.lastDate.startsWith(month) && s.amount - s.previousAmount >= 50)
    .map((s) => ({
      id: `${month}:sub:${vendorKey(s.vendor)}`, kind: 'subscription_change' as const, priority: 2 as const,
      vendor: s.vendor, amount: s.amount - s.previousAmount,
      title: `${s.vendor} went up`,
      body: `Now ${formatCents(s.amount)} a month, up from ${formatCents(s.previousAmount)}.`,
      card: { label: s.vendor, tag: 'Price went up', figure: `${formatCents(s.amount)}/mo`, note: `Was ${formatCents(s.previousAmount)}`, tone: 'warn' as const },
    }));
}

export interface CutIdea {
  /** Short name for a list row: a bucket, a store, or "Subscriptions". */
  label: string;
  /** One short line for a list row. */
  note: string;
  bucketId?: string;
  title: string;
  detail: string;
  /** Rough monthly saving if acted on. */
  saving: Cents;
}

/**
 * Concrete ways to spend less this month, biggest first. Used for the "How can I cut
 * spending?" question and given to Claude as facts.
 */
export function waysToCut(input: InsightInput, bucketName: (id: string) => string): CutIdea[] {
  const { month, today, daysInMonth, statuses, transactions, allocations } = input;
  const ideas: CutIdea[] = [];

  // 1. Buckets heading over their limit.
  for (const s of statuses) {
    const pace = bucketPace(s, today, daysInMonth);
    const over = Math.max(s.overBy, pace.projectedTotal - s.bucket.monthlyLimit);
    if (over <= 0 || s.bucket.monthlyLimit <= 0) continue;
    const w = weeklyAllowance(s, today, daysInMonth);
    const allowance = w.kind === 'week'
      ? { short: `keep to ${short(w.amount)}/week`, long: `Keeping to about ${short(w.amount)} a week stays within it.` }
      : { short: w.text, long: `Keeping to ${w.text.replace(' left for', ' for the last')} stays within it.` };
    ideas.push({
      label: s.bucket.name,
      bucketId: s.bucket.id,
      note: s.overBy > 0
        ? `${short(s.overBy)} over already, pause for the month`
        : `On pace for ${short(pace.projectedTotal)} of ${short(s.bucket.monthlyLimit)}, ${allowance.short}`,
      title: `Slow down on ${s.bucket.name}`,
      detail: s.overBy > 0
        ? `Already ${formatCents(s.overBy)} over. Pausing it for the rest of the month keeps the overage from growing.`
        : `On pace for ${short(pace.projectedTotal)} against a ${short(s.bucket.monthlyLimit)} limit. ${allowance.long}`,
      saving: over,
    });
  }

  // 2. Biggest optional vendors this month.
  const thisMonth = new Set(transactions.filter((t) => t.date.startsWith(month)).map((t) => t.id));
  const vendorSpend = new Map<string, { label: string; total: Cents; count: number; bucket: string }>();
  for (const a of allocations) {
    if (!thisMonth.has(a.transactionId) || !DISCRETIONARY.has(a.bucketId)) continue;
    const tx = transactions.find((t) => t.id === a.transactionId)!;
    const v = vendorKey(tx.merchant);
    const e = vendorSpend.get(v) ?? { label: tx.merchant.trim(), total: 0, count: 0, bucket: a.bucketId };
    e.total += a.amount; e.count++;
    vendorSpend.set(v, e);
  }
  for (const e of [...vendorSpend.values()].sort((a, b) => b.total - a.total).slice(0, 3)) {
    if (e.total < 3000) continue;
    ideas.push({
      label: e.label,
      bucketId: e.bucket,
      note: `${short(e.total)} over ${e.count} order${e.count > 1 ? 's' : ''}, halve it`,
      title: `${e.label}: ${short(e.total)} so far`,
      detail: `${e.count} purchase${e.count > 1 ? 's' : ''} this month in ${bucketName(e.bucket)}. Halving it would save about ${short(e.total / 2)}.`,
      saving: Math.round(e.total / 2),
    });
  }

  // 3. Subscriptions add up.
  const subs = findSubscriptions(transactions);
  const subTotal = subs.reduce((s, x) => s + x.amount, 0);
  if (subs.length >= 2) {
    ideas.push({
      label: 'Subscriptions',
      note: `${subs.length} for ${short(subTotal)}/mo, cancel one you rarely use`,
      title: `Review ${subs.length} subscriptions (${short(subTotal)}/mo)`,
      detail: `${subs.slice(0, 4).map((s) => `${s.vendor} ${formatCents(s.amount)}`).join(', ')}. Cancelling one you rarely use is the easiest saving.`,
      saving: subs[subs.length - 1].amount,
    });
  }

  return ideas.sort((a, b) => b.saving - a.saving);
}
