import { vendorKey } from './filters.ts';
import { formatCents, shortDate } from './money.ts';
import type { Tone } from './pace.ts';
import type { Allocation, Bucket, Cents, Transaction } from './types.ts';

/**
 * The weekly money recap: the last 7 days compared with the 7 before. Every number is
 * computed here so it is exact; on the backend Claude only words the summary.
 *
 * Fixed bills (rent, utilities, loan payments) are reported apart from everyday spending,
 * so a rent week doesn't drown out what the family actually chose to spend.
 */
export interface RecapPoint {
  kind: 'bucket_up' | 'bucket_down' | 'biggest' | 'top_store' | 'new_store' | 'bills';
  label: string;
  figure: string;
  note: string;
  tone: Tone | 'neutral';
  bucketId?: string;
  vendor?: string;
  transactionId?: string;
}

export interface WeeklyRecap {
  /** First and last day covered, YYYY-MM-DD. */
  start: string;
  end: string;
  /** Everyday spending (fixed bills left out) and how many purchases. */
  spent: Cents;
  count: number;
  prevSpent: Cents;
  /**
   * The median of the 8 weeks before, when there are at least 4 weeks of history. Real
   * spending is lumpy week to week, so this is a steadier comparison than the week before.
   */
  typicalSpent: Cents | null;
  /** A week's share of the everyday buckets' monthly limits. */
  pace: Cents;
  billsTotal: Cents;
  /** Everyday spending per day, oldest first, 7 entries. */
  days: { date: string; spent: Cents }[];
  buckets: { bucketId: string; name: string; spent: Cents; prevSpent: Cents }[];
  points: RecapPoint[];
  /** A plain one-sentence summary; the backend has Claude write a friendlier one. */
  headline: string;
  tone: Tone;
}

export interface RecapInput {
  transactions: Transaction[];
  allocations: Allocation[];
  buckets: Bucket[];
  /** The last day of the recap, YYYY-MM-DD (usually today). */
  end: string;
}

const FIXED_CATEGORIES = new Set(['RENT_AND_UTILITIES', 'LOAN_PAYMENTS']);
/** Buckets that hold fixed bills, left out of the weekly pace. */
const FIXED_BUCKETS = new Set(['housing', 'bills']);
/** Changes smaller than this aren't worth a line. */
const NOTABLE = 2500;

const isBill = (t: Transaction) => FIXED_CATEGORIES.has(t.plaidCategory ?? '');
const short = (c: Cents) => formatCents(c, { showCents: false });

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const daysIn = (date: string) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();

export function weeklyRecap({ transactions, allocations, buckets, end }: RecapInput): WeeklyRecap {
  const start = addDays(end, -6);
  const prevStart = addDays(end, -13);
  const inWeek = (t: Transaction) => t.date >= start && t.date <= end;
  const inPrev = (t: Transaction) => t.date >= prevStart && t.date < start;

  const week = transactions.filter(inWeek);
  const everyday = week.filter((t) => !isBill(t));
  const bills = week.filter((t) => isBill(t) && t.amount > 0);
  const prevEveryday = transactions.filter((t) => inPrev(t) && !isBill(t));
  const sum = (ts: Transaction[]) => ts.reduce((s, t) => s + t.amount, 0);

  const spent = sum(everyday);
  const prevSpent = sum(prevEveryday);
  const earliest = transactions.reduce((m, t) => (t.date < m ? t.date : m), end);
  const history = Array.from({ length: 8 }, (_, i) => addDays(start, -7 * (i + 1)))
    .filter((s0) => s0 >= earliest)
    .map((s0) => sum(transactions.filter((t) => !isBill(t) && t.date >= s0 && t.date <= addDays(s0, 6))))
    .sort((a, b) => a - b);
  const typicalSpent = history.length >= 4
    ? Math.round(history.length % 2 ? history[(history.length - 1) / 2] : (history[history.length / 2 - 1] + history[history.length / 2]) / 2)
    : null;
  const count = everyday.filter((t) => t.amount > 0).length;
  const everydayLimit = buckets.filter((b) => !b.archived && !FIXED_BUCKETS.has(b.id)).reduce((s, b) => s + b.monthlyLimit, 0);
  const pace = Math.round((everydayLimit * 7) / daysIn(end));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, spent: sum(everyday.filter((t) => t.date === date)) };
  });

  // Bucket totals for each week, from allocations so receipt splits count in the right place.
  const byBucket = (ts: Transaction[]) => {
    const ids = new Set(ts.map((t) => t.id));
    const m = new Map<string, Cents>();
    for (const a of allocations) if (ids.has(a.transactionId)) m.set(a.bucketId, (m.get(a.bucketId) ?? 0) + a.amount);
    return m;
  };
  const now = byBucket(everyday);
  const before = byBucket(prevEveryday);
  const name = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned';
  const bucketRows = [...new Set([...now.keys(), ...before.keys()])]
    .map((bucketId) => ({ bucketId, name: name(bucketId), spent: now.get(bucketId) ?? 0, prevSpent: before.get(bucketId) ?? 0 }))
    .sort((a, b) => b.spent - a.spent);

  const points: RecapPoint[] = [];
  const changes = bucketRows.map((b) => ({ ...b, delta: b.spent - b.prevSpent }));
  const up = [...changes].sort((a, b) => b.delta - a.delta)[0];
  if (up && up.delta >= NOTABLE) {
    points.push({ kind: 'bucket_up', label: up.name, figure: short(up.spent), note: `▲ ${short(up.delta)} vs last week`, tone: 'warn', bucketId: up.bucketId });
  }
  const down = [...changes].sort((a, b) => a.delta - b.delta)[0];
  if (down && -down.delta >= NOTABLE) {
    points.push({ kind: 'bucket_down', label: down.name, figure: short(down.spent), note: `▼ ${short(-down.delta)} vs last week`, tone: 'good', bucketId: down.bucketId });
  }

  const biggest = [...everyday].sort((a, b) => b.amount - a.amount)[0];
  if (biggest && biggest.amount > 0) {
    points.push({ kind: 'biggest', label: biggest.merchant, figure: short(biggest.amount), note: `Biggest · ${shortDate(biggest.date)}`, tone: 'neutral', vendor: biggest.merchant, transactionId: biggest.id });
  }

  // Most-visited store, when someone went more than once.
  const visits = new Map<string, { label: string; visits: number; total: Cents }>();
  for (const t of everyday) {
    if (t.amount <= 0) continue;
    const k = vendorKey(t.merchant);
    const v = visits.get(k) ?? { label: t.merchant, visits: 0, total: 0 };
    visits.set(k, { ...v, visits: v.visits + 1, total: v.total + t.amount });
  }
  const top = [...visits.values()].sort((a, b) => b.visits - a.visits || b.total - a.total)[0];
  if (top && top.visits >= 2) {
    points.push({ kind: 'top_store', label: top.label, figure: short(top.total), note: `${top.visits} visits`, tone: 'neutral', vendor: top.label });
  }

  // Stores never seen before this week.
  const seen = new Set(transactions.filter((t) => t.date < start).map((t) => vendorKey(t.merchant)));
  const fresh = [...visits.entries()].filter(([k]) => !seen.has(k)).sort((a, b) => b[1].total - a[1].total)[0];
  if (fresh) {
    points.push({ kind: 'new_store', label: fresh[1].label, figure: short(fresh[1].total), note: 'New store', tone: 'neutral', vendor: fresh[1].label });
  }

  const billsTotal = sum(bills);
  if (billsTotal > 0) {
    const names = [...new Set(bills.map((b) => b.merchant))];
    points.push({ kind: 'bills', label: 'Bills paid', figure: short(billsTotal), note: names.length === 1 ? names[0] : `${names.length} bills`, tone: 'neutral' });
  }

  const diff = spent - pace;
  const tone: Tone = diff <= 0 ? 'good' : diff <= pace * 0.15 ? 'warn' : 'bad';
  const lead = up && up.delta >= NOTABLE && diff > 0 ? ` Mostly ${up.name}.` : '';
  const headline = pace <= 0
    ? `${short(spent)} spent across ${count} purchase${count === 1 ? '' : 's'}.`
    : diff <= 0
      ? `${short(spent)} spent, ${short(-diff)} under pace.`
      : `${short(spent)} spent, ${short(diff)} over pace.${lead}`;

  return { start, end, spent, count, prevSpent, typicalSpent, pace, billsTotal, days, buckets: bucketRows, points, headline, tone };
}

/** The recap as plain facts for Claude: dollars as text, so the model never does the arithmetic. */
export function recapFacts(r: WeeklyRecap) {
  const $ = (c: Cents) => formatCents(c, { showCents: false });
  return {
    week: `${shortDate(r.start)} to ${shortDate(r.end)}`,
    everyday_spent: $(r.spent),
    purchases: r.count,
    weekly_pace: r.pace > 0 ? $(r.pace) : null,
    vs_pace: r.pace > 0 ? (r.spent <= r.pace ? `${$(r.pace - r.spent)} under` : `${$(r.spent - r.pace)} over`) : null,
    week_before: $(r.prevSpent),
    typical_week: r.typicalSpent !== null ? $(r.typicalSpent) : null,
    bills_paid: r.billsTotal > 0 ? $(r.billsTotal) : null,
    by_bucket: r.buckets.filter((b) => b.spent || b.prevSpent).map((b) => ({ bucket: b.name, this_week: $(b.spent), week_before: $(b.prevSpent) })),
    stood_out: r.points.map((p) => `${p.label}: ${p.figure} (${p.note})`),
  };
}
