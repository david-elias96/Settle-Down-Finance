import type { Allocation, Cents, Month, Transaction } from './types';

export interface TrendPoint {
  /** Day of month, 1-based. */
  day: number;
  /** Total spent from the 1st through this day. */
  cumulative: Cents;
}

export const daysInMonth = (month: Month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function previousMonth(month: Month): Month {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Running total of budgeted spending for each day of `month`, from bucket allocations
 * (so receipt splits and refunds count correctly). Stops at `throughDay` when given,
 * e.g. today for the current month.
 */
export function cumulativeSpend(
  transactions: Pick<Transaction, 'id' | 'date'>[],
  allocations: Allocation[],
  month: Month,
  throughDay = daysInMonth(month),
): TrendPoint[] {
  const dateOf = new Map(transactions.map((t) => [t.id, t.date]));
  const perDay = new Array<Cents>(daysInMonth(month) + 1).fill(0);
  for (const a of allocations) {
    const date = dateOf.get(a.transactionId);
    if (!date || date.slice(0, 7) !== month) continue;
    perDay[Number(date.slice(8, 10))] += a.amount;
  }
  const points: TrendPoint[] = [];
  let running = 0;
  for (let day = 1; day <= Math.min(throughDay, perDay.length - 1); day++) {
    running += perDay[day];
    points.push({ day, cumulative: running });
  }
  return points;
}

export interface MonthComparison {
  current: TrendPoint[];
  previous: TrendPoint[];
  /** Spent this month so far. */
  spentSoFar: Cents;
  /** Spent last month by the same day of the month. */
  previousByThisDay: Cents;
  /** Positive = spending more than last month at this point. */
  difference: Cents;
  previousTotal: Cents;
}

export function compareToLastMonth(
  transactions: Pick<Transaction, 'id' | 'date'>[],
  allocations: Allocation[],
  month: Month,
  today: number,
): MonthComparison {
  const current = cumulativeSpend(transactions, allocations, month, today);
  const previous = cumulativeSpend(transactions, allocations, previousMonth(month));
  const spentSoFar = current.at(-1)?.cumulative ?? 0;
  // Last month may be shorter (e.g. the 31st vs February): use its last day.
  const previousByThisDay = previous[Math.min(today, previous.length) - 1]?.cumulative ?? 0;
  return {
    current,
    previous,
    spentSoFar,
    previousByThisDay,
    difference: spentSoFar - previousByThisDay,
    previousTotal: previous.at(-1)?.cumulative ?? 0,
  };
}
