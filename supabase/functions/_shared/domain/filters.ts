import type { Allocation, Cents, Month, Transaction } from './types.ts';

export interface TransactionFilter {
  /** "YYYY-MM", or null for all months. */
  month: Month | null;
  bucketId: string | null;
  /** Vendor key from `vendorKey`, or null for all vendors. */
  vendor: string | null;
}

export const NO_FILTER: TransactionFilter = { month: null, bucketId: null, vendor: null };

/** Groups "TARGET", "Target" and "Target " as one vendor. */
export const vendorKey = (merchant: string) => merchant.trim().replace(/\s+/g, ' ').toLowerCase();

export interface FilteredTransaction {
  tx: Transaction;
  /** This transaction's bucket parts (only the matching bucket when filtering by bucket). */
  parts: Allocation[];
  /** Amount that counts toward the filter: the bucket's share when filtering by bucket. */
  amount: Cents;
}

export function filterTransactions(
  transactions: Transaction[],
  allocations: Allocation[],
  f: TransactionFilter,
): { items: FilteredTransaction[]; total: Cents } {
  const byTx = new Map<string, Allocation[]>();
  for (const a of allocations) byTx.set(a.transactionId, [...(byTx.get(a.transactionId) ?? []), a]);

  const items: FilteredTransaction[] = [];
  for (const tx of transactions) {
    if (f.month && !tx.date.startsWith(f.month)) continue;
    if (f.vendor && vendorKey(tx.merchant) !== f.vendor) continue;
    let parts = byTx.get(tx.id) ?? [];
    let amount = tx.amount;
    if (f.bucketId) {
      parts = parts.filter((p) => p.bucketId === f.bucketId);
      if (!parts.length) continue;
      amount = parts.reduce((s, p) => s + p.amount, 0);
    }
    items.push({ tx, parts, amount });
  }
  items.sort((a, b) => b.tx.date.localeCompare(a.tx.date));
  return { items, total: items.reduce((s, i) => s + i.amount, 0) };
}

export interface Option {
  value: string;
  label: string;
  count: number;
  total: Cents;
}

/** Months that have transactions, newest first. */
export function monthOptions(transactions: Transaction[]): Option[] {
  const m = new Map<string, Option>();
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    const o = m.get(key) ?? { value: key, label: monthLabel(key), count: 0, total: 0 };
    o.count++; o.total += tx.amount;
    m.set(key, o);
  }
  return [...m.values()].sort((a, b) => b.value.localeCompare(a.value));
}

/**
 * Vendors that actually appear in the transactions (respecting the other filters),
 * most-spent first. Display name is the most common spelling seen.
 */
export function vendorOptions(transactions: Transaction[]): Option[] {
  const m = new Map<string, Option & { spellings: Map<string, number> }>();
  for (const tx of transactions) {
    const key = vendorKey(tx.merchant);
    const o = m.get(key) ?? { value: key, label: tx.merchant.trim(), count: 0, total: 0, spellings: new Map() };
    o.count++; o.total += tx.amount;
    o.spellings.set(tx.merchant.trim(), (o.spellings.get(tx.merchant.trim()) ?? 0) + 1);
    m.set(key, o);
  }
  return [...m.values()]
    .map(({ spellings, ...o }) => ({ ...o, label: [...spellings].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export function monthLabel(month: Month) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export interface StoreSummary { store: string; visits: number; total: Cents; lastDate: string }

/** Stores ranked by number of purchases ("visits") or by money spent, optionally within some months. */
export function topStores(transactions: Transaction[], { months, by = 'visits', limit = 5 }: { months?: Month[]; by?: 'visits' | 'spend'; limit?: number } = {}): StoreSummary[] {
  const txs = transactions.filter((t) => t.amount > 0 && (!months?.length || months.includes(t.date.slice(0, 7))));
  const last = new Map<string, string>();
  for (const t of txs) {
    const k = vendorKey(t.merchant);
    if ((last.get(k) ?? '') < t.date) last.set(k, t.date);
  }
  return vendorOptions(txs)
    .map((o) => ({ store: o.label, visits: o.count, total: o.total, lastDate: last.get(o.value) ?? '' }))
    .sort((a, b) => (by === 'visits' ? b.visits - a.visits || b.total - a.total : b.total - a.total))
    .slice(0, limit);
}
