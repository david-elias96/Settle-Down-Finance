import type { BucketStatus } from './budget.ts';
import type { Cents } from './types.ts';
import { formatCents } from './money.ts';

export type PaceStatus = 'under' | 'on_track' | 'over';

export interface BucketPace {
  status: PaceStatus;
  /** Whole percent of the monthly limit used, e.g. 73. */
  percentUsed: number;
  /** What an even pace would have spent by today. */
  expectedByToday: Cents;
  /** Fraction of the month elapsed, 0..1 (for drawing the pace marker). */
  monthElapsed: number;
  /** Month-end total if spending continues at the current daily rate. */
  projectedTotal: Cents;
  /** Short status label, e.g. "On track". */
  label: string;
  /** One-line explanation, e.g. "$40 under where an even pace would be by Nov 9". */
  detail: string;
}

/** Spending within this share of the even pace counts as on track. */
const TOLERANCE = 0.1;

/**
 * Compares a bucket's spending with an even pace through the month.
 * Over budget always counts as "over"; otherwise more than 10% ahead of pace is
 * "over", more than 10% behind is "under", and anything in between is "on track".
 */
export function bucketPace(s: BucketStatus, day: number, daysInMonth: number): BucketPace {
  const limit = s.bucket.monthlyLimit;
  const monthElapsed = Math.min(1, Math.max(0, day / daysInMonth));
  // Bills land on one day, not spread over the month: count paid ones as they are, plan for
  // the ones still to come, and pace only the everyday spending over what's left.
  const billsPaid = Math.min(s.bills?.paid ?? 0, s.spent);
  const billsTotal = billsPaid + (s.bills?.toCome ?? 0);
  const everyday = s.spent - billsPaid;
  const expectedByToday = Math.round(billsPaid + Math.max(0, limit - billsTotal) * monthElapsed);
  const projectedTotal = Math.round(billsTotal + (day > 0 ? (everyday / day) * daysInMonth : everyday));
  const percentUsed = limit > 0 ? Math.round((s.spent / limit) * 100) : s.spent > 0 ? 100 : 0;
  const gap = s.spent - expectedByToday;
  const band = Math.max(100, expectedByToday * TOLERANCE); // at least $1 so tiny buckets aren't jumpy

  let status: PaceStatus;
  let label: string;
  let detail: string;
  if (s.overBy > 0) {
    status = 'over';
    label = 'Over budget';
    detail = `${formatCents(s.overBy)} over this month's ${formatCents(limit, { showCents: false })} limit`;
  } else if (gap > band) {
    status = 'over';
    label = 'Over pace';
    detail = `${formatCents(gap, { showCents: false })} ahead of an even pace. At this rate: ${formatCents(projectedTotal, { showCents: false })} by month end`;
  } else if (gap < -band) {
    status = 'under';
    label = 'Under pace';
    detail = `${formatCents(-gap, { showCents: false })} under an even pace. ${formatCents(s.remaining, { showCents: false })} left`;
  } else {
    status = 'on_track';
    label = 'On track';
    detail = `${formatCents(s.remaining, { showCents: false })} left for the rest of the month`;
  }
  return { status, percentUsed, expectedByToday, monthElapsed, projectedTotal, label, detail };
}

/** A text progress bar that renders in any notification: "▰▰▰▰▰▰▰▱▱▱". */
export function textBar(ratio: number, slots = 10): string {
  const filled = Math.max(0, Math.min(slots, Math.floor(ratio * slots)));
  return '▰'.repeat(filled) + '▱'.repeat(slots - filled);
}

export type Tone = 'good' | 'warn' | 'bad';

/** One status vocabulary for the whole app: tag text plus its color. */
export function paceTag(s: BucketStatus, pace: BucketPace): { tag: string; tone: Tone } {
  if (s.overBy > 0) return { tag: 'Over budget', tone: 'bad' };
  if (pace.status === 'over' && pace.projectedTotal > s.bucket.monthlyLimit) return { tag: 'Heading over', tone: 'warn' };
  return { tag: 'On track', tone: 'good' };
}

/**
 * What's left to spend, framed per week (easier to plan around than per day). In the
 * last week it gives the total left instead; over budget it gives nothing.
 */
export function weeklyAllowance(s: BucketStatus, day: number, daysInMonth: number):
  { kind: 'week'; amount: Cents; text: string } | { kind: 'rest'; amount: Cents; days: number; text: string } | { kind: 'none'; text: string } {
  const daysLeft = Math.max(1, daysInMonth - day);
  const left = Math.max(0, s.remaining);
  if (s.overBy > 0 || left === 0) return { kind: 'none', text: s.overBy > 0 ? `${formatCents(s.overBy, { showCents: false })} over` : 'Nothing left' };
  if (daysLeft < 7) return { kind: 'rest', amount: left, days: daysLeft, text: `${formatCents(left, { showCents: false })} left for ${daysLeft} day${daysLeft > 1 ? 's' : ''}` };
  const amount = Math.round((left / daysLeft) * 7);
  return { kind: 'week', amount, text: `${formatCents(amount, { showCents: false })}/week left` };
}

/** Buckets needing attention first: over budget, then heading over, then by how much is used. */
export function byAttention(statuses: BucketStatus[], day: number, daysInMonth: number): BucketStatus[] {
  const rank = (s: BucketStatus) => ({ bad: 0, warn: 1, good: 2 })[paceTag(s, bucketPace(s, day, daysInMonth)).tone];
  return [...statuses].sort((a, b) => rank(a) - rank(b) || b.ratio - a.ratio);
}
