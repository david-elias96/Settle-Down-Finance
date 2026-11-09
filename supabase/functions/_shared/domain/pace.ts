import type { BucketStatus } from './budget';
import type { Cents } from './types';
import { formatCents } from './money';

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
  const expectedByToday = Math.round(limit * monthElapsed);
  const projectedTotal = day > 0 ? Math.round((s.spent / day) * daysInMonth) : s.spent;
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
