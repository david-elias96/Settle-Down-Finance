import type { Bill } from './bills';
import type { BucketStatus } from './budget';
import type { MonthForecast } from './forecast';
import { daysInMonth } from './trend';
import type { Cents, Month, Transaction } from './types';

/**
 * "Free to spend": the one number on the home screen. It answers "what can I spend?"
 * instead of "what have I spent?", so nobody has to do subtraction.
 *
 * Take the month's budget, subtract what was spent before today and the bills still to
 * come, and spread the rest evenly over the days left (today included). The number is
 * fixed at the start of the day, so it doesn't shrink while you shop; today's own
 * spending is reported next to it instead.
 */
export interface FreeToSpend {
  /** Everyday money per day, from today through the end of the month. Never negative. */
  perDay: Cents;
  /** Days left in the month, counting today. */
  daysLeft: number;
  /** Everyday spending so far today (bills paid today are left out). */
  spentToday: Cents;
  /** What's left of today's amount. Negative when today went over. */
  leftToday: Cents;
  /** Budget minus everything spent so far minus bills still to come. Negative when over. */
  leftThisMonth: Cents;
  /** Bills expected later this month, already set aside. */
  billsToCome: Cents;
  /** Total of the bucket limits, and total spent so far. */
  budget: Cents;
  spent: Cents;
}

export function freeToSpend(
  statuses: Pick<BucketStatus, 'spent' | 'bucket'>[],
  bills: Pick<Bill, 'status' | 'amount' | 'paid'>[],
  transactions: Pick<Transaction, 'id' | 'date' | 'amount'>[],
  month: Month,
  today: number,
): FreeToSpend {
  const budget = statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
  const spent = statuses.reduce((s, b) => s + b.spent, 0);
  const billsToCome = bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0);
  const todayIso = `${month}-${String(today).padStart(2, '0')}`;
  const billsPaidToday = bills.filter((b) => b.paid?.date === todayIso);
  const billIds = new Set(billsPaidToday.map((b) => b.paid!.transactionId));
  const spentToday = transactions.filter((t) => t.date === todayIso && t.amount > 0 && !billIds.has(t.id)).reduce((s, t) => s + t.amount, 0);

  const daysLeft = Math.max(1, daysInMonth(month) - today + 1);
  const leftThisMonth = budget - spent - billsToCome;
  // As of this morning: add today's everyday spending back in.
  const perDay = Math.max(0, Math.round((leftThisMonth + spentToday) / daysLeft));
  return { perDay, daysLeft, spentToday, leftToday: perDay - spentToday, leftThisMonth, billsToCome, budget, spent };
}

export type Verdict = { text: string; tone: 'good' | 'warn' | 'bad' };

/**
 * The home screen's headline: one calm sentence on how the month is going, from the
 * forecast's likely month-end total against the budget.
 */
export function monthVerdict(free: Pick<FreeToSpend, 'budget' | 'spent'>, forecast?: Pick<MonthForecast, 'end'>, bucketsOver = 0): Verdict {
  if (free.budget <= 0) return { text: 'Set a budget to begin.', tone: 'good' };
  if (free.spent > free.budget) return { text: 'Over budget.', tone: 'bad' };
  if (forecast && forecast.end.mid > free.budget) return { text: 'Heading over budget.', tone: 'warn' };
  if (forecast && forecast.end.high > free.budget) return { text: 'On track, barely.', tone: 'warn' };
  // Fine overall, but a bucket is past its limit (the overspending Savings shows): say both.
  if (bucketsOver > 0) return { text: `On track. ${bucketsOver} bucket${bucketsOver === 1 ? '' : 's'} over.`, tone: 'warn' };
  return { text: 'On track.', tone: 'good' };
}

/** One stop on the month-ahead path: the bills due on a day and what's left after them. */
export interface AheadStop {
  date: string;
  day: number;
  bills: Bill[];
  /** Budget left once these bills (and all earlier ones) are paid. */
  leftAfter: Cents;
  /** A bill here is past its usual date and hasn't been seen yet. */
  late: boolean;
}

/**
 * The rest of the month as a path: unpaid bills grouped by due day, with a running
 * "left after" figure. Bills not yet seen past their usual date come first, as due today.
 */
export function monthAhead(bills: Bill[], free: Pick<FreeToSpend, 'budget' | 'spent'>, month: Month, today: number): AheadStop[] {
  const todayIso = `${month}-${String(today).padStart(2, '0')}`;
  const byDate = new Map<string, Bill[]>();
  for (const b of bills) {
    if (b.status === 'paid') continue;
    const date = b.dueDate < todayIso ? todayIso : b.dueDate;
    byDate.set(date, [...(byDate.get(date) ?? []), b]);
  }
  let left = free.budget - free.spent;
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, group]) => {
    left -= group.reduce((s, b) => s + b.amount, 0);
    return { date, day: Number(date.slice(8, 10)), bills: group, leftAfter: left, late: group.some((b) => b.status === 'late') };
  });
}
