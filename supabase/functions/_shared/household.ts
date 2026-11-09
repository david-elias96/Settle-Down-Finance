import { admin } from './supabase.ts';
import {
  bucketStatuses, type Allocation, type Bucket, type BucketStatus, type InsightInput, type Transaction,
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

  const [{ data: bucketRows }, { data: txRows }, { data: allocRows }] = await Promise.all([
    admin.from('buckets').select('*').eq('household_id', householdId),
    admin.from('transactions').select('*').eq('household_id', householdId).gte('date', since),
    admin.from('allocations').select('*, transactions!inner(date)').eq('household_id', householdId).gte('transactions.date', since),
  ]);
  const idOf = (row: { id: string; slug: string | null }) => row.slug ?? row.id;
  const bucketIdMap = new Map((bucketRows ?? []).map((b) => [b.id, idOf(b)]));

  const buckets: Bucket[] = (bucketRows ?? []).map((b) => ({
    id: idOf(b), name: b.name, icon: b.icon, monthlyLimit: b.monthly_limit, isCustom: b.is_custom, archived: b.archived,
  }));
  const transactions: Transaction[] = (txRows ?? []).map((t) => ({
    id: t.id, accountId: t.account_id, merchant: t.merchant, amount: t.amount, date: t.date, pending: t.pending,
    plaidCategory: t.plaid_category ?? undefined, plaidDetailedCategory: t.plaid_detailed_category ?? undefined,
  }));
  const allocations: Allocation[] = (allocRows ?? []).map((a) => ({
    transactionId: a.transaction_id, bucketId: bucketIdMap.get(a.bucket_id) ?? a.bucket_id, amount: a.amount, source: a.source,
  }));
  const statuses: BucketStatus[] = bucketStatuses(buckets, transactions, allocations, month);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  return {
    householdId, month, today: now.getUTCDate(), todayIso: now.toISOString().slice(0, 10), daysInMonth, buckets, statuses, transactions, allocations,
    bucketName: (id) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned',
  };
}
