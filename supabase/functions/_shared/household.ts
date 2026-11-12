import { admin } from './supabase.ts';
import {
  applySplits, billsByBucket, bucketStatuses, findBills, withBills, type Allocation, type Bucket, type BucketStatus, type InsightInput,
  type SplitSettings, type Transaction,
} from './domain/index.ts';

export interface HouseholdData extends InsightInput {
  householdId: string;
  buckets: Bucket[];
  bucketName: (id: string) => string;
  /** Today as YYYY-MM-DD. */
  todayIso: string;
}

/**
 * Loads a household's budget in the shape the shared budget logic expects. Default buckets
 * use their slug ('dining') as id so the logic's discretionary list applies; custom buckets
 * keep their uuid.
 */
export async function loadHousehold(householdId: string, monthsBack = 4): Promise<HouseholdData> {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1)).toISOString().slice(0, 10);

  const [{ data: bucketRows }, { data: txRows }, { data: allocRows }, { data: splitRows }] = await Promise.all([
    admin.from('buckets').select('*').eq('household_id', householdId),
    admin.from('transactions').select('*').eq('household_id', householdId).gte('date', since),
    admin.from('allocations').select('*, transactions!inner(date)').eq('household_id', householdId).gte('transactions.date', since),
    admin.from('bill_splits').select('transaction_id, vendor_key, ways, fraction').eq('household_id', householdId),
  ]);
  const idOf = (row: { id: string; slug: string | null }) => row.slug ?? row.id;
  const bucketIdMap = new Map((bucketRows ?? []).map((b) => [b.id, idOf(b)]));

  const buckets: Bucket[] = (bucketRows ?? []).map((b) => ({
    id: idOf(b), name: b.name, icon: b.icon, monthlyLimit: b.monthly_limit, isCustom: b.is_custom, archived: b.archived,
  }));
  const rawTransactions: Transaction[] = (txRows ?? []).map((t) => ({
    id: t.id, accountId: t.account_id, merchant: t.merchant, amount: t.amount, date: t.date, pending: t.pending,
    plaidCategory: t.plaid_category ?? undefined, plaidDetailedCategory: t.plaid_detailed_category ?? undefined,
  }));
  const rawAllocations: Allocation[] = (allocRows ?? []).map((a) => ({
    transactionId: a.transaction_id, bucketId: bucketIdMap.get(a.bucket_id) ?? a.bucket_id, amount: a.amount, source: a.source,
  }));
  // Bills shared with people outside the app count at the household's share, as in the app.
  const splits: SplitSettings = { byTransaction: {}, byVendor: {} };
  for (const s of splitRows ?? []) {
    const split = { ways: s.ways, fraction: Number(s.fraction) };
    if (s.transaction_id) splits.byTransaction[s.transaction_id] = split; else splits.byVendor[s.vendor_key] = split;
  }
  const { transactions, allocations } = applySplits(rawTransactions, rawAllocations, splits);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // Rent and other monthly bills are planned for, not paced as daily spending.
  const bills = findBills(transactions, month, now.getUTCDate(), allocations);
  const statuses: BucketStatus[] = withBills(bucketStatuses(buckets, transactions, allocations, month), billsByBucket(bills));

  return {
    householdId, month, today: now.getUTCDate(), todayIso: now.toISOString().slice(0, 10), daysInMonth, buckets, statuses, transactions, allocations,
    bucketName: (id) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned',
  };
}
