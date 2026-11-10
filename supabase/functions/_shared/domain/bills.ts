import { vendorKey } from './filters.ts';
import { formatCents, shortDate } from './money.ts';
import { daysInMonth } from './trend.ts';
import type { Allocation, Cents, Month, Transaction } from './types.ts';

/**
 * Bill forecasting: finds charges that come once a month (rent, utilities, phone, insurance,
 * loan payments, subscriptions) and says which are paid this month and which are still to come.
 *
 * Real bills are messy, so this allows for:
 * - paying a few days early: rent sent on the 30th counts for the next month, so a month
 *   can't look like it has two rents (or none);
 * - amounts that vary (phone, power): the expected amount is the median of recent months,
 *   with the low-high range shown;
 * - skipped months: a bill seen in most recent months still counts.
 */
export interface Bill {
  vendor: string;
  key: string;
  /** Expected amount this month (median of recent months) and the recent range. */
  amount: Cents;
  low: Cents;
  high: Cents;
  /** Whether the amount changes month to month by more than a few dollars. */
  varies: boolean;
  /** When it's due this month (YYYY-MM-DD), from the usual day it's paid. */
  dueDate: string;
  status: 'paid' | 'due' | 'late';
  /** This month's payment, when it has come in. */
  paid?: { amount: Cents; date: string; transactionId: string };
  /** Bucket of the latest payment, so buckets can plan for it. */
  bucketId?: string;
  /** How many months it's been seen. */
  months: number;
}

/**
 * For a bill usually paid around the 1st, a payment in the last few days of the month before
 * counts for the coming month. Bills paid mid-month or late in the month aren't shifted.
 */
const EARLY_DAYS = 3;
const START_DAYS = 5;
/** Days after the usual date before a missing bill is called late. */
const GRACE_DAYS = 3;

const monthIndex = (m: Month) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** The month a payment counts for, and its day relative to that month (0 or less = paid early). */
function cycleOf(date: string, paidAroundFirst: boolean): { cycle: number; offset: number } {
  const m = monthIndex(date.slice(0, 7));
  const day = Number(date.slice(8, 10));
  const len = daysInMonth(date.slice(0, 7));
  return paidAroundFirst && day > len - EARLY_DAYS ? { cycle: m + 1, offset: day - len } : { cycle: m, offset: day };
}

/** Everyday spending categories: a store visited monthly here is shopping, not a bill. */
const NOT_BILLS = new Set(['FOOD_AND_DRINK', 'TRANSPORTATION', 'TRAVEL', 'GENERAL_MERCHANDISE', 'HOME_IMPROVEMENT']);
const BILL_CATEGORIES = new Set(['RENT_AND_UTILITIES', 'LOAN_PAYMENTS']);

export function findBills(
  transactions: Pick<Transaction, 'id' | 'date' | 'merchant' | 'amount' | 'plaidCategory'>[],
  month: Month,
  today: number,
  allocations: Pick<Allocation, 'transactionId' | 'bucketId'>[] = [],
): Bill[] {
  const now = monthIndex(month);
  const byVendor = new Map<string, typeof transactions>();
  for (const t of transactions) {
    if (t.amount <= 0 || (t.plaidCategory && NOT_BILLS.has(t.plaidCategory))) continue;
    const k = vendorKey(t.merchant);
    byVendor.set(k, [...(byVendor.get(k) ?? []), t]);
  }
  const bucketOf = new Map(allocations.map((a) => [a.transactionId, a.bucketId]));

  // A store billed several times a month (Apple, Google, Amazon) may still hold a monthly
  // bill at one fixed price, so those are also looked at price by price.
  const groups: [string, typeof transactions][] = [];
  for (const [key, txs] of byVendor) {
    groups.push([key, txs]);
    const months = new Set(txs.map((t) => t.date.slice(0, 7)));
    if (txs.length > months.size * 1.25) {
      const byPrice = new Map<number, typeof transactions>();
      for (const t of txs) byPrice.set(t.amount, [...(byPrice.get(t.amount) ?? []), t]);
      for (const [price, same] of byPrice) if (same.length >= 2) groups.push([`${key}|${price}`, same]);
    }
  }

  const bills: Bill[] = [];
  const found = new Set<string>();
  for (const [key, txs] of groups) {
    // Skip a price group when the store as a whole was already found to be a bill.
    if (found.has(key.split('|')[0])) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const paidAroundFirst = sorted.some((t) => Number(t.date.slice(8, 10)) <= START_DAYS);
    const cycles = new Map<number, { total: Cents; offset: number; last: (typeof txs)[number] }>();
    for (const t of sorted) {
      const { cycle, offset } = cycleOf(t.date, paidAroundFirst);
      const c = cycles.get(cycle);
      cycles.set(cycle, c ? { total: c.total + t.amount, offset: c.offset, last: t } : { total: t.amount, offset, last: t });
    }
    // One payment per month: several in a month means it's a store, not a bill.
    if (sorted.length > cycles.size * 1.25) continue;
    const past = [...cycles.entries()].filter(([c]) => c < now).sort((a, b) => a[0] - b[0]);
    if (past.length < 2) continue;
    // Seen in most of the months since it started (allows one skipped month), and recently.
    const span = now - past[0][0];
    if (past.length < Math.max(2, span * 0.6) || now - past.at(-1)![0] > 2) continue;

    // Paid on about the same day each month.
    const offsets = past.map(([, c]) => c.offset);
    const usual = median(offsets);
    if (offsets.filter((o) => Math.abs(o - usual) <= 6).length < offsets.length * 0.75) continue;

    // A similar amount each month, unless it's a utility or loan (those vary).
    const recent = past.slice(-3).map(([, c]) => c.total);
    const amount = median(recent);
    const low = Math.min(...recent); const high = Math.max(...recent);
    const isBillCategory = sorted.some((t) => t.plaidCategory && BILL_CATEGORIES.has(t.plaidCategory));
    if (!isBillCategory && (high - low) > amount * 0.25) continue;

    const len = daysInMonth(month);
    const dueDay = Math.min(len, Math.max(1, usual));
    const dueDate = `${month}-${String(dueDay).padStart(2, '0')}`;
    const thisMonth = cycles.get(now);
    const lastTx = (thisMonth ?? past.at(-1)![1]).last;
    const status: Bill['status'] = thisMonth ? 'paid' : today > dueDay + GRACE_DAYS ? 'late' : 'due';

    found.add(key);
    bills.push({
      vendor: lastTx.merchant.trim(), key, amount, low, high, varies: high - low > 300,
      dueDate, status, months: past.length + (thisMonth ? 1 : 0), bucketId: bucketOf.get(lastTx.id),
      paid: thisMonth ? { amount: thisMonth.total, date: thisMonth.last.date, transactionId: thisMonth.last.id } : undefined,
    });
  }
  return bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amount - a.amount);
}

export interface BillsOutlook {
  paid: Cents;
  /** Bills still expected this month, including ones not seen yet past their usual date. */
  toCome: Cents;
  bills: Bill[];
}

export function billsOutlook(bills: Bill[]): BillsOutlook {
  return {
    bills,
    paid: bills.reduce((s, b) => s + (b.paid?.amount ?? 0), 0),
    toCome: bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0),
  };
}

/** "Due Nov 15", "Paid Nov 1", or "Not seen yet · usually Nov 1". */
export function billNote(b: Bill): string {
  if (b.status === 'paid') return `Paid ${shortDate(b.paid!.date)}`;
  if (b.status === 'late') return `Not seen yet · usually ${shortDate(b.dueDate)}`;
  return `Due ${shortDate(b.dueDate)}`;
}

/** "$128", "$9.99", or for an amount that varies, "$96–$112". */
export function billFigure(b: Bill): string {
  const $ = (c: Cents) => formatCents(c, { showCents: c % 100 !== 0 });
  if (b.status === 'paid') return $(b.paid!.amount);
  return b.varies ? `${formatCents(b.low, { showCents: false })}–${formatCents(b.high, { showCents: false })}` : $(b.amount);
}

/** Per bucket: bills already paid this month and those still expected, for planning the pace. */
export function billsByBucket(bills: Bill[]): Map<string, { paid: Cents; toCome: Cents }> {
  const m = new Map<string, { paid: Cents; toCome: Cents }>();
  for (const b of bills) {
    if (!b.bucketId) continue;
    const e = m.get(b.bucketId) ?? { paid: 0, toCome: 0 };
    if (b.status === 'paid') e.paid += b.paid!.amount; else e.toCome += b.amount;
    m.set(b.bucketId, e);
  }
  return m;
}
