import { formatCents, monthOf } from './money.ts';
import { previousMonth } from './trend.ts';
import type { Allocation, Bucket, Cents, Month, Transaction } from './types.ts';

/**
 * Spending patterns and budget tune-ups, worked out from whole past months.
 *
 * Real months are lumpy: a trip, a wedding or a new couch can make one month several times
 * the usual. So "typical" here is the median month, and a month more than 2.5 times the
 * median of the others is treated as a one-off and left out (and said so).
 */
const short = (c: Cents) => formatCents(c, { showCents: false });
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: Month) => MONTHS[Number(m.slice(5, 7)) - 1];

/**
 * Whole months before `month` that have data, newest first, at most `max`. The first month
 * counts only if data starts in its first few days (otherwise it's a partial month).
 */
export function fullMonths(transactions: Pick<Transaction, 'date'>[], month: Month, max = 6): Month[] {
  const first = transactions.reduce((m, t) => (t.date < m ? t.date : m), `${month}-01`);
  const out: Month[] = [];
  for (let m = previousMonth(month); out.length < max; m = previousMonth(m)) {
    if (m < first.slice(0, 7) || (m === first.slice(0, 7) && Number(first.slice(8, 10)) > 5)) break;
    out.push(m);
  }
  return out;
}

/** Each bucket's total for each of the given months. */
export function monthlyByBucket(
  transactions: Pick<Transaction, 'id' | 'date'>[], allocations: Allocation[], months: Month[],
): Map<string, Map<Month, Cents>> {
  const monthOfTx = new Map(transactions.map((t) => [t.id, monthOf(t.date)]));
  const wanted = new Set(months);
  const out = new Map<string, Map<Month, Cents>>();
  for (const a of allocations) {
    const m = monthOfTx.get(a.transactionId);
    if (!m || !wanted.has(m)) continue;
    const row = out.get(a.bucketId) ?? new Map<Month, Cents>();
    row.set(m, (row.get(m) ?? 0) + a.amount);
    out.set(a.bucketId, row);
  }
  return out;
}

/** The typical month, leaving out one-off months. */
export function typicalMonth(values: { month: Month; total: Cents }[]): { typical: Cents; oneOffs: { month: Month; total: Cents }[] } {
  if (values.length < 3) return { typical: median(values.map((v) => v.total)), oneOffs: [] };
  const oneOffs = values.filter((v) => {
    const others = median(values.filter((o) => o !== v).map((o) => o.total));
    return v.total > Math.max(others * 2.5, others + 10000);
  });
  const kept = values.filter((v) => !oneOffs.includes(v));
  return { typical: median(kept.map((v) => v.total)), oneOffs };
}

export interface TuneUp {
  bucketId: string;
  name: string;
  kind: 'raise' | 'lower';
  limit: Cents;
  typical: Cents;
  suggested: Cents;
  /** "Usually $640 a month" plus any one-off left out. */
  reason: string;
}

/**
 * Buckets never suggested lower: health costs are rare but can't be skipped, and housing and
 * bills are set by contracts, not habits.
 */
const NEVER_LOWER = new Set(['health', 'housing', 'bills', 'other']);
/** Bills land on uneven calendar days (rent paid on the 30th), so month-to-month trends there are noise. */
const NO_TRENDS = new Set(['housing', 'bills']);

/** Round up to the next $10. */
const roundUp10 = (c: Cents) => Math.ceil(c / 1000) * 1000;

/**
 * Suggests limits that match how the family actually spends: raise a bucket that runs over
 * most months (a budget that's always blown stops meaning anything), lower one that's barely
 * used so the money can go to savings or a tighter bucket. Needs two whole months. A bucket
 * isn't lowered below what's already been spent in it this month. At most `max` suggestions.
 */
export function budgetTuneUps(
  buckets: Bucket[], transactions: Pick<Transaction, 'id' | 'date'>[], allocations: Allocation[], month: Month,
  { spentThisMonth = new Map<string, Cents>(), max = 5 }: { spentThisMonth?: Map<string, Cents>; max?: number } = {},
): TuneUp[] {
  const months = fullMonths(transactions, month);
  if (months.length < 2) return [];
  const byBucket = monthlyByBucket(transactions, allocations, months);
  const out: TuneUp[] = [];
  for (const b of buckets.filter((x) => !x.archived)) {
    const row = byBucket.get(b.id);
    const values = months.map((m) => ({ month: m, total: row?.get(m) ?? 0 }));
    const { typical, oneOffs } = typicalMonth(values);
    const left = oneOffs.length ? `, leaving out ${oneOffs.map((o) => `${short(o.total)} in ${monthName(o.month)}`).join(' and ')}` : '';
    const over = values.filter((v) => !oneOffs.includes(v) && v.total > b.monthlyLimit).length;
    const kept = values.length - oneOffs.length;
    if (typical > b.monthlyLimit * 1.1 && typical - b.monthlyLimit >= 2500 && over >= kept / 2) {
      const suggested = roundUp10(typical * 1.05);
      out.push({ bucketId: b.id, name: b.name, kind: 'raise', limit: b.monthlyLimit, typical, suggested,
        reason: `Usually ${short(typical)} a month. Over budget ${over} of the last ${kept} months${left}` });
    } else if (typical < b.monthlyLimit * 0.7 && !NEVER_LOWER.has(b.id)) {
      const already = spentThisMonth.get(b.id) ?? 0;
      const unused = values.every((v) => v.total <= 0);
      if (unused && already <= 0) {
        out.push({ bucketId: b.id, name: b.name, kind: 'lower', limit: b.monthlyLimit, typical: 0, suggested: 0,
          reason: `Not used in the last ${values.length} months` });
        continue;
      }
      const suggested = Math.max(roundUp10(typical * 1.15), 1000);
      if (b.monthlyLimit - suggested >= 2500 && already <= suggested * 0.8) {
        out.push({ bucketId: b.id, name: b.name, kind: 'lower', limit: b.monthlyLimit, typical, suggested,
          reason: `Usually ${short(typical)} of ${short(b.monthlyLimit)} a month${left}` });
      }
    }
  }
  // Biggest change first.
  return out.sort((a, b) => Math.abs(b.suggested - b.limit) - Math.abs(a.suggested - a.limit)).slice(0, max);
}

export interface Trend {
  bucketId: string;
  name: string;
  lastMonth: Month;
  last: Cents;
  typical: Cents;
  change: Cents;
}

/**
 * Buckets where last month was well above or below the typical month before it. Needs three
 * whole months so there's a typical month to compare with.
 */
export function bucketTrends(
  buckets: Bucket[], transactions: Pick<Transaction, 'id' | 'date'>[], allocations: Allocation[], month: Month,
): Trend[] {
  const months = fullMonths(transactions, month);
  if (months.length < 3) return [];
  const [lastMonth, ...earlier] = months;
  const byBucket = monthlyByBucket(transactions, allocations, months);
  return buckets.filter((b) => !b.archived && !NO_TRENDS.has(b.id)).flatMap((b) => {
    const row = byBucket.get(b.id);
    const last = row?.get(lastMonth) ?? 0;
    const { typical } = typicalMonth(earlier.map((m) => ({ month: m, total: row?.get(m) ?? 0 })));
    const change = last - typical;
    // At least $40 and 30% either way, so normal wobble isn't called a trend.
    return Math.abs(change) >= 4000 && Math.abs(change) >= typical * 0.3
      ? [{ bucketId: b.id, name: b.name, lastMonth, last, typical, change }] : [];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export interface SmallPurchases {
  /** Purchases under the threshold in the last whole month, and their total. */
  count: number;
  total: Cents;
  month: Month;
  /** The same over a typical month, when there are several. */
  typicalTotal: Cents | null;
  threshold: Cents;
}

/** Small purchases (coffee, snacks, app charges) that each feel like nothing but add up. */
export function smallPurchases(
  transactions: Pick<Transaction, 'date' | 'amount' | 'plaidCategory'>[], month: Month, threshold: Cents = 1500,
): SmallPurchases | null {
  const months = fullMonths(transactions, month);
  if (!months.length) return null;
  const small = (m: Month) => transactions.filter((t) => t.amount > 0 && t.amount < threshold && monthOf(t.date) === m
    && t.plaidCategory !== 'RENT_AND_UTILITIES' && t.plaidCategory !== 'LOAN_PAYMENTS');
  const last = small(months[0]);
  if (last.length < 5) return null;
  const totals = months.map((m) => small(m).reduce((s, t) => s + t.amount, 0));
  return {
    count: last.length, total: totals[0], month: months[0], threshold,
    typicalTotal: months.length >= 3 ? median(totals) : null,
  };
}

/** Plain-language lines for the patterns, for the Patterns screen and for Ask. */
export function trendNote(t: Trend): string {
  return `${short(t.last)} in ${monthName(t.lastMonth)} vs ${short(t.typical)} in a typical month`;
}
export function smallNote(s: SmallPurchases): string {
  return `${s.count} purchases under ${short(s.threshold)} in ${monthName(s.month)}`
    + (s.typicalTotal !== null ? ` · usually ${short(s.typicalTotal)} a month` : '');
}
