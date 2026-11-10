import { formatCents } from './money.ts';
import { vendorKey } from './filters.ts';
import type { Allocation, Cents, Transaction } from './types.ts';

/**
 * Splitting a shared bill, such as rent paid in full and split three ways.
 * Only the household's share counts toward buckets, totals and forecasts.
 */
export interface BillSplit {
  /** "Split 3 ways". Null when the user typed their own share. */
  ways: number | null;
  /** The household's share as a fraction of the charge, e.g. 1/3. */
  fraction: number;
}

export interface SplitSettings {
  /** One-off splits, by transaction id. */
  byTransaction: Record<string, BillSplit>;
  /** Splits applied to every charge from a vendor (rent, utilities), by vendorKey. */
  byVendor: Record<string, BillSplit>;
}

export const NO_SPLITS: SplitSettings = { byTransaction: {}, byVendor: {} };

export const splitWays = (ways: number): BillSplit => ({ ways, fraction: 1 / ways });
export const splitShare = (share: Cents, full: Cents): BillSplit => ({ ways: null, fraction: Math.min(1, Math.max(0, share / full)) });

/** The split that applies to a charge, if any. A one-off split wins over a vendor rule. */
export function splitFor(tx: Transaction, s: SplitSettings): (BillSplit & { recurring: boolean }) | null {
  if (tx.amount <= 0) return null;
  const one = s.byTransaction[tx.id];
  if (one) return { ...one, recurring: false };
  const rule = s.byVendor[vendorKey(tx.merchant)];
  return rule ? { ...rule, recurring: true } : null;
}

/**
 * Applies splits: each split charge's amount becomes the household's share, and its bucket
 * allocations shrink in proportion (rounded so they still add up to the share exactly).
 */
export function applySplits(transactions: Transaction[], allocations: Allocation[], s: SplitSettings): { transactions: Transaction[]; allocations: Allocation[] } {
  const shares = new Map<string, { share: Cents; full: Cents }>();
  const txs = transactions.map((tx) => {
    const sp = splitFor(tx, s);
    if (!sp || sp.fraction >= 1) return tx;
    const share = Math.round(tx.amount * sp.fraction);
    shares.set(tx.id, { share, full: tx.amount });
    return { ...tx, amount: share, split: { fullAmount: tx.amount, ways: sp.ways, recurring: sp.recurring } };
  });
  if (!shares.size) return { transactions, allocations };

  const byTx = new Map<string, Allocation[]>();
  for (const a of allocations) byTx.set(a.transactionId, [...(byTx.get(a.transactionId) ?? []), a]);
  const out: Allocation[] = [];
  for (const [txId, parts] of byTx) {
    const sh = shares.get(txId);
    if (!sh) { out.push(...parts); continue; }
    // Largest-remainder rounding keeps the parts summing exactly to the share.
    const raw = parts.map((p) => (p.amount * sh.share) / sh.full);
    const floored = raw.map(Math.floor);
    let left = sh.share - floored.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - floored[i], i] as const).sort((a, b) => b[0] - a[0]);
    for (const [, i] of order) { if (left <= 0) break; floored[i]++; left--; }
    parts.forEach((p, i) => out.push({ ...p, amount: floored[i] }));
  }
  return { transactions: txs, allocations: out };
}

/** "Your 1/3 of $3,450" or "Your share of $3,450". */
export function splitLabel(tx: Transaction): string | null {
  if (!tx.split) return null;
  const full = formatCents(tx.split.fullAmount, { showCents: tx.split.fullAmount % 100 !== 0 });
  return tx.split.ways ? `Your 1/${tx.split.ways} of ${full}` : `Your share of ${full}`;
}
