import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Allocation, BillSplit, Bucket, CreditState, Member, MerchantRule, SavingsGoal, SplitSettings, Transaction } from '@/src/domain';

/**
 * Reads and writes a household's budget in Supabase, in the same shapes the screens use with
 * the sample data. Row-level security limits every query to the signed-in member's household.
 *
 * Default buckets use their slug ('dining') as their id in the app, like the backend does, so
 * the budget logic's lists of everyday and fixed buckets apply. Custom buckets keep their uuid.
 */
export interface HouseholdSnapshot {
  buckets: Bucket[];
  transactions: Transaction[];
  allocations: Allocation[];
  rules: MerchantRule[];
  goals: SavingsGoal[];
  splits: SplitSettings;
  members: Member[];
  accounts: Account[];
  credits: CreditState | null;
  /** App bucket id → database uuid, for writes. */
  bucketUuid: Map<string, string>;
}

/** Months of history to load: six whole months for patterns, plus this one. */
const MONTHS_BACK = 7;
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
/** Reads every row, a page at a time (Supabase returns at most 1,000 rows per request). */
async function all<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
const one = async <T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
};

export function sinceDate(now = new Date(), monthsBack = MONTHS_BACK) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1)).toISOString().slice(0, 10);
}

export async function loadHousehold(db: SupabaseClient, householdId: string, userId: string): Promise<HouseholdSnapshot> {
  const since = sinceDate();
  const h = householdId;
  const [bucketRows, txRows, allocRows, ruleRows, goalRows, splitRows, memberRows, accountRows, institutionRows, credit] = await Promise.all([
    all<any>((a, b) => db.from('buckets').select('id, slug, name, icon, monthly_limit, is_custom, archived, sort_order').eq('household_id', h).order('sort_order').order('id').range(a, b)),
    all<any>((a, b) => db.from('transactions')
      .select('id, plaid_transaction_id, account_id, merchant, amount, date, pending, plaid_category, plaid_detailed_category')
      .eq('household_id', h).gte('date', since).order('date').order('id').range(a, b)),
    all<any>((a, b) => db.from('allocations').select('transaction_id, bucket_id, amount, source, reason, transactions!inner(date)')
      .eq('household_id', h).gte('transactions.date', since).order('transaction_id').order('bucket_id').range(a, b)),
    all<any>((a, b) => db.from('merchant_rules').select('id, match, bucket_id').eq('household_id', h).order('id').range(a, b)),
    all<any>((a, b) => db.from('savings_goals').select('id, name, target, balance, monthly_contribution, priority, target_date').eq('household_id', h).order('priority').range(a, b)),
    all<any>((a, b) => db.from('bill_splits').select('transaction_id, vendor_key, ways, fraction').eq('household_id', h).order('id').range(a, b)),
    all<any>((a, b) => db.from('household_members').select('user_id, role, display_name, joined_at').eq('household_id', h).order('joined_at').range(a, b)),
    // Never plaid_items itself: the app reads institutions through the view, which leaves out secret references.
    all<any>((a, b) => db.from('accounts').select('id, name, mask, owner_user_id, plaid_item_id').eq('household_id', h).order('id').range(a, b)),
    all<any>((a, b) => db.from('linked_institutions').select('id, institution_name').eq('household_id', h).order('id').range(a, b)),
    one<any>(db.from('credit_balances').select('allowance, period, used_this_month, extra').eq('household_id', h).maybeSingle()),
  ]);

  const bucketId = new Map<string, string>(bucketRows.map((b) => [b.id, b.slug ?? b.id]));
  const bucketUuid = new Map<string, string>(bucketRows.map((b) => [b.slug ?? b.id, b.id]));
  const institution = new Map<string, string>(institutionRows.map((i) => [i.id, i.institution_name ?? '']));

  const byTransaction: Record<string, BillSplit> = {};
  const byVendor: Record<string, BillSplit> = {};
  for (const s of splitRows) {
    const split: BillSplit = { ways: s.ways, fraction: Number(s.fraction) };
    if (s.transaction_id) byTransaction[s.transaction_id] = split; else byVendor[s.vendor_key] = split;
  }

  return {
    bucketUuid,
    buckets: bucketRows.map((b) => ({ id: b.slug ?? b.id, name: b.name, icon: b.icon, monthlyLimit: Number(b.monthly_limit), isCustom: b.is_custom, archived: b.archived })),
    transactions: txRows.map((t) => ({
      id: t.id, externalId: t.plaid_transaction_id ?? undefined, accountId: t.account_id, merchant: t.merchant, amount: Number(t.amount),
      date: t.date, pending: t.pending, plaidCategory: t.plaid_category ?? undefined, plaidDetailedCategory: t.plaid_detailed_category ?? undefined,
    })),
    allocations: allocRows.map((a) => ({
      transactionId: a.transaction_id, bucketId: bucketId.get(a.bucket_id) ?? a.bucket_id, amount: Number(a.amount), source: a.source,
      ...(a.reason ? { reason: a.reason } : {}),
    })),
    rules: ruleRows.map((r) => ({ match: r.match, bucketId: bucketId.get(r.bucket_id) ?? r.bucket_id })),
    goals: goalRows.map((g) => ({
      id: g.id, name: g.name, target: Number(g.target), balance: Number(g.balance), monthlyContribution: Number(g.monthly_contribution),
      priority: g.priority, ...(g.target_date ? { targetDate: g.target_date } : {}),
    })),
    splits: { byTransaction, byVendor },
    members: memberRows.map((m) => ({ id: m.user_id, name: m.user_id === userId ? 'You' : m.display_name?.trim() || 'Family member', role: m.role })),
    accounts: accountRows.map((a) => ({
      id: a.id, name: a.name, institution: institution.get(a.plaid_item_id) || a.name, ...(a.mask ? { mask: a.mask } : {}), ownerId: a.owner_user_id ?? '',
    })),
    credits: credit ? { period: credit.period, allowance: credit.allowance, usedThisMonth: credit.used_this_month, extra: credit.extra } : null,
  };
}

const check = async (q: PromiseLike<{ error: { message: string } | null }>) => {
  const { error } = await q;
  if (error) throw new Error(error.message);
};

/** Writes for the screens' changes. Each throws on failure so the store can reload. */
export function householdWriter(db: SupabaseClient, householdId: string, bucketUuid: (appId: string) => string) {
  const h = householdId;
  return {
    setBucketLimit: (bucketId: string, monthlyLimit: number) =>
      check(db.from('buckets').update({ monthly_limit: monthlyLimit }).eq('id', bucketUuid(bucketId)).eq('household_id', h)),

    /** Returns the new bucket's id. */
    addBucket: async (name: string, monthlyLimit: number, icon: string, sortOrder: number) => {
      const row = await one<{ id: string }>(db.from('buckets')
        .insert({ household_id: h, name, icon, monthly_limit: monthlyLimit, is_custom: true, sort_order: sortOrder }).select('id').single());
      return row!.id;
    },

    /** Replaces the bucket split of each listed purchase with `allocations` (theirs only). */
    replaceAllocations: async (transactionIds: string[], allocations: Allocation[]) => {
      if (!transactionIds.length) return;
      await check(db.from('allocations').delete().eq('household_id', h).in('transaction_id', transactionIds));
      const rows = allocations.filter((a) => transactionIds.includes(a.transactionId)).map((a) => ({
        household_id: h, transaction_id: a.transactionId, bucket_id: bucketUuid(a.bucketId), amount: a.amount, source: a.source, reason: a.reason ?? null,
      }));
      if (rows.length) await check(db.from('allocations').insert(rows));
    },

    setRule: async (match: string, bucketId: string) => {
      await check(db.from('merchant_rules').delete().eq('household_id', h).eq('match', match));
      await check(db.from('merchant_rules').insert({ household_id: h, match, bucket_id: bucketUuid(bucketId) }));
    },

    /** Clears any split on this purchase and its vendor, then saves the new one (if any). */
    setBillSplit: async (transactionId: string, vendorKey: string, split: BillSplit | null, everyCharge: boolean) => {
      await check(db.from('bill_splits').delete().eq('household_id', h).eq('transaction_id', transactionId));
      await check(db.from('bill_splits').delete().eq('household_id', h).eq('vendor_key', vendorKey));
      if (!split) return;
      await check(db.from('bill_splits').insert({
        household_id: h, ways: split.ways, fraction: split.fraction,
        ...(everyCharge ? { vendor_key: vendorKey } : { transaction_id: transactionId }),
      }));
    },

    /** Returns the new goal's id. */
    addGoal: async (g: Omit<SavingsGoal, 'id'>) => {
      const row = await one<{ id: string }>(db.from('savings_goals').insert({ household_id: h, ...goalRow(g), priority: g.priority }).select('id').single());
      return row!.id;
    },
    updateGoal: (id: string, g: Omit<SavingsGoal, 'id' | 'priority'>) =>
      check(db.from('savings_goals').update(goalRow(g)).eq('id', id).eq('household_id', h)),
    deleteGoal: (id: string) => check(db.from('savings_goals').delete().eq('id', id).eq('household_id', h)),
    setGoalPriorities: (goals: Pick<SavingsGoal, 'id' | 'priority'>[]) =>
      Promise.all(goals.map((g) => check(db.from('savings_goals').update({ priority: g.priority }).eq('id', g.id).eq('household_id', h)))).then(() => {}),
  };
}

function goalRow(g: Omit<SavingsGoal, 'id' | 'priority'>) {
  return { name: g.name, target: g.target, balance: g.balance, monthly_contribution: g.monthlyContribution, target_date: g.targetDate ?? null };
}
