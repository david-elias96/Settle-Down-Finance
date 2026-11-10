import { findBills } from './bills.ts';
import type { Insight } from './insights.ts';
import { formatCents } from './money.ts';
import { vendorKey } from './filters.ts';
import { daysInMonth, previousMonth } from './trend.ts';
import type { Allocation, Cents, Month, Transaction } from './types.ts';

export interface ForecastPoint {
  day: number;
  /** 10th percentile: a light-spending finish. */
  low: Cents;
  /** Median: the most likely running total. */
  mid: Cents;
  /** 90th percentile: a heavy-spending finish. */
  high: Cents;
}

export interface MonthForecast {
  /** Running totals from today to month end; the first point is today's actual total. */
  points: ForecastPoint[];
  end: ForecastPoint;
  /** Subscriptions expected later this month, included in every run. */
  upcomingBills: { vendor: string; amount: Cents; day: number }[];
  method: 'monte_carlo' | 'pace';
}

const isWeekend = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

/** Small seeded PRNG so the forecast doesn't jitter between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Forecasts where this month's spending will end up.
 *
 * Bills that repeat monthly (subscriptions) are placed on the day they're due. Everything
 * else is simulated: each remaining day draws a real day of past spending (weekdays from
 * weekdays, weekends from weekends; this month's days count double so recent habits weigh
 * more). Running that 1,000 times gives a spread of possible month-ends, from which we take
 * the median and a 10th–90th percentile range. With under two weeks of history it falls
 * back to a straight-line pace.
 */
export function forecastMonth(
  transactions: Pick<Transaction, 'id' | 'date' | 'merchant' | 'amount' | 'plaidCategory'>[],
  allocations: Allocation[],
  month: Month,
  today: number,
  { historyMonths = 3, runs = 1000 } = {},
): MonthForecast {
  const days = daysInMonth(month);
  const txById = new Map(transactions.map((t) => [t.id, t]));
  // Monthly bills (rent, utilities, subscriptions) are placed on their due day, not sampled.
  const bills = findBills(transactions, month, today);
  const recurring = new Set(bills.map((b) => b.key));

  // Daily totals of non-recurring spending, keyed by date.
  const daily = new Map<string, Cents>();
  let spentSoFar = 0;
  for (const a of allocations) {
    const tx = txById.get(a.transactionId);
    if (!tx) continue;
    if (tx.date.slice(0, 7) === month && Number(tx.date.slice(8, 10)) <= today) spentSoFar += a.amount;
    if (recurring.has(vendorKey(tx.merchant))) continue;
    daily.set(tx.date, (daily.get(tx.date) ?? 0) + a.amount);
  }

  // Sample pool: every day of the last few full months (zero-spend days included), plus
  // this month's finished days (today is still in progress), weighted double.
  const pool = { weekday: [] as Cents[], weekend: [] as Cents[] };
  const add = (date: string, times: number) => {
    for (let i = 0; i < times; i++) (isWeekend(date) ? pool.weekend : pool.weekday).push(daily.get(date) ?? 0);
  };
  // Days before the first known transaction (e.g. before the bank was linked) aren't
  // real zero-spend days, so they're left out.
  const firstDate = transactions.reduce((min, t) => (t.date < min ? t.date : min), `${month}-01`);
  let m = month;
  for (let i = 0; i < historyMonths; i++) {
    m = previousMonth(m);
    for (let d = 1; d <= daysInMonth(m); d++) {
      const date = `${m}-${String(d).padStart(2, '0')}`;
      if (date >= firstDate) add(date, 1);
    }
  }
  for (let d = 1; d < today; d++) add(`${month}-${String(d).padStart(2, '0')}`, 2);

  // Bills still to come this month, on their usual day (tomorrow if one is running late).
  const upcomingBills = bills
    .filter((b) => b.status !== 'paid')
    .map((b) => ({ vendor: b.vendor, amount: b.amount, day: Math.max(today + 1, Number(b.dueDate.slice(8, 10))) }))
    .filter((b) => b.day <= days);
  const billsOn = new Array<Cents>(days + 1).fill(0);
  for (const b of upcomingBills) billsOn[b.day] += b.amount;

  const start: ForecastPoint = { day: today, low: spentSoFar, mid: spentSoFar, high: spentSoFar };
  if (today >= days) return { points: [start], end: start, upcomingBills, method: 'monte_carlo' };

  if (pool.weekday.length + pool.weekend.length < 14) {
    const perDay = today > 0 ? spentSoFar / today : 0;
    const points = [start];
    let bills = 0;
    for (let d = today + 1; d <= days; d++) {
      bills += billsOn[d];
      const v = Math.round(spentSoFar + perDay * (d - today) + bills);
      points.push({ day: d, low: v, mid: v, high: v });
    }
    return { points, end: points.at(-1)!, upcomingBills, method: 'pace' };
  }

  const all = [...pool.weekday, ...pool.weekend];
  const pick = (date: string) => {
    const p = isWeekend(date) ? pool.weekend : pool.weekday;
    return p.length >= 4 ? p : all;
  };
  const rand = mulberry32(Number(month.replace('-', '')) * 31 + today);
  const remaining = days - today;
  // sims[d][r] = running total on day today+1+d in run r.
  const sims = Array.from({ length: remaining }, () => new Float64Array(runs));
  const poolFor = Array.from({ length: remaining }, (_, i) => pick(`${month}-${String(today + 1 + i).padStart(2, '0')}`));
  for (let r = 0; r < runs; r++) {
    let total = spentSoFar;
    for (let i = 0; i < remaining; i++) {
      const p = poolFor[i];
      total += p[Math.floor(rand() * p.length)] + billsOn[today + 1 + i];
      sims[i][r] = total;
    }
  }
  const pct = (sorted: Float64Array, q: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
  const points = [start, ...sims.map((s, i) => {
    s.sort();
    return { day: today + 1 + i, low: pct(s, 0.1), mid: pct(s, 0.5), high: pct(s, 0.9) };
  })];
  return { points, end: points.at(-1)!, upcomingBills, method: 'monte_carlo' };
}

/**
 * The month-end outlook as an insight card: where spending is heading, compared with
 * the total budget and last month.
 */
export function projectionInsight(
  forecast: MonthForecast,
  { month, budgetTotal, previousTotal, previousMonthName }: { month: Month; budgetTotal: Cents; previousTotal: Cents; previousMonthName: string },
): Insight | null {
  if (forecast.points.length < 2) return null;
  const short = (c: Cents) => formatCents(c, { showCents: false });
  const { low, mid, high } = forecast.end;
  const range = high > low ? `Likely ${short(low)}–${short(high)}. ` : '';
  const vsBudget = budgetTotal > 0 ? mid - budgetTotal : 0;
  const vsLast = previousTotal > 0 ? mid - previousTotal : 0;

  let compare: string;
  if (vsBudget > 0) compare = `About ${short(vsBudget)} over your ${short(budgetTotal)} budget.`;
  else if (previousTotal > 0) compare = `${short(Math.abs(vsLast))} ${vsLast >= 0 ? 'more' : 'less'} than ${previousMonthName}, and within budget.`;
  else compare = budgetTotal > 0 ? `${short(-vsBudget)} under your budget.` : '';

  return {
    id: `${month}:projection`, kind: 'month_projection',
    priority: vsBudget > 0 ? 3 : vsLast > 0 ? 2 : 1,
    title: `Heading for about ${short(mid)} this month`,
    body: `${range}${compare}`.trim(),
    amount: mid,
    card: {
      label: `Projected by ${new Date(`${month}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${daysInMonth(month)}`,
      tag: vsBudget > 0 ? 'Over budget pace' : vsLast > 0 ? `Above ${previousMonthName}` : 'On track',
      figure: short(mid),
      note: vsBudget > 0 ? `${short(vsBudget)} over your ${short(budgetTotal)} budget` : previousTotal > 0 ? `${short(previousTotal)} in ${previousMonthName}` : '',
      range: high > low ? { low, mid, high, ...(previousTotal > 0 ? { marker: previousTotal, markerLabel: previousMonthName } : {}) } : undefined,
      tone: vsBudget > 0 ? 'bad' : vsLast > 0 ? 'warn' : 'good',
    },
  };
}
