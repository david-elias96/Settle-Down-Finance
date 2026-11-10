import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { bucketStatuses, compareToLastMonth, forecastMonth, projectionInsight, previousMonth, CREDIT_COST, creditsLeft, daysInMonth, findInsights, overspendImpact, PLANS, spendCredits, waysToCut, type Account, type Allocation, type Member, type CreditReason, type CreditState, type Bucket, type SavingsGoal, type GoalFields, type Transaction, applySplits, vendorKey, type BillSplit, type MerchantRule, type SplitSettings, weeklyRecap, findBills, billsByBucket, billsOutlook, withBills, budgetTuneUps, bucketTrends, smallPurchases } from '@/src/domain';
import { demoAccounts, demoAllocations, demoBuckets, demoGoals, demoMembers, demoRules, demoSplits, demoTransactions } from './demo';

/**
 * App state. Backed by demo data for now; will be swapped for Supabase queries
 * once the backend is connected, keeping the same shape for screens.
 */
function useBudgetState() {
  const [buckets, setBuckets] = useState<Bucket[]>(demoBuckets);
  const [rawTransactions] = useState<Transaction[]>(demoTransactions);
  const [rawAllocations, setRawAllocations] = useState<Allocation[]>(demoAllocations);
  const [rules, setRules] = useState<MerchantRule[]>(demoRules);
  /**
   * Moves a purchase to another bucket. With `always`, the store gets a rule and its other
   * purchases that weren't placed by hand or by a receipt move too.
   */
  const moveToBucket = (txId: string, bucketId: string, always: boolean) => {
    const tx = rawTransactions.find((t) => t.id === txId);
    if (!tx) return;
    const key = vendorKey(tx.merchant);
    const sameStore = new Set(rawTransactions.filter((t) => vendorKey(t.merchant) === key).map((t) => t.id));
    setRawAllocations((all) => {
      const movable = (a: Allocation) => a.transactionId === txId
        || (always && sameStore.has(a.transactionId) && a.source !== 'user' && a.source !== 'receipt' && all.filter((b) => b.transactionId === a.transactionId).length === 1);
      return all.map((a) => (movable(a) ? { transactionId: a.transactionId, bucketId, amount: a.amount, source: 'user' as const } : a))
        // A receipt split collapses into one bucket.
        .filter((a, i, arr) => a.transactionId !== txId || arr.findIndex((b) => b.transactionId === txId) === i)
        .map((a) => (a.transactionId === txId ? { ...a, amount: tx.amount } : a));
    });
    if (always) setRules((rs) => [...rs.filter((r) => r.match !== key), { match: key, bucketId }]);
  };
  const [splits, setSplits] = useState<SplitSettings>(demoSplits);
  // Everything downstream sees split bills at the household's share.
  const { transactions, allocations } = useMemo(() => applySplits(rawTransactions, rawAllocations, splits), [rawTransactions, rawAllocations, splits]);
  /** Split a bill (or stop splitting it). `everyCharge` applies it to every charge from that vendor. */
  const setBillSplit = (txId: string, split: BillSplit | null, everyCharge: boolean) => {
    const tx = rawTransactions.find((t) => t.id === txId);
    if (!tx) return;
    const key = vendorKey(tx.merchant);
    setSplits((s) => {
      const byTransaction = { ...s.byTransaction }; const byVendor = { ...s.byVendor };
      delete byTransaction[txId];
      delete byVendor[key];
      if (split && everyCharge) byVendor[key] = split;
      else if (split) byTransaction[txId] = split;
      return { byTransaction, byVendor };
    });
  };
  const [goals, setGoals] = useState<SavingsGoal[]>(demoGoals);
  /** New goals start as the least protected, so overspending draws from them before older goals. */
  const addGoal = (fields: GoalFields) =>
    setGoals((gs) => [...gs, { ...fields, id: `goal-${Date.now()}`, priority: Math.max(0, ...gs.map((g) => g.priority)) + 1 }]);
  const updateGoal = (id: string, fields: GoalFields) =>
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...fields } : g)));
  const deleteGoal = (id: string) => setGoals((gs) => gs.filter((g) => g.id !== id));
  const month = new Date().toISOString().slice(0, 7);

  const today = new Date().getDate();
  // Monthly bills, so buckets plan for rent and utilities instead of pacing them day by day.
  const bills = useMemo(() => billsOutlook(findBills(transactions, month, today, allocations)), [transactions, month, today, allocations]);
  const statuses = useMemo(
    () => withBills(bucketStatuses(buckets, transactions, allocations, month), billsByBucket(bills.bills)),
    [buckets, transactions, allocations, month, bills],
  );
  const impact = useMemo(() => overspendImpact(statuses, goals), [statuses, goals]);
  const insightInput = useMemo(
    () => ({ month, today, daysInMonth: daysInMonth(month), statuses, transactions, allocations }),
    [month, today, statuses, transactions, allocations],
  );
  const cutIdeas = useMemo(
    () => waysToCut(insightInput, (id) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned'),
    [insightInput, buckets],
  );
  const forecast = useMemo(() => forecastMonth(transactions, allocations, month, today), [transactions, allocations, month, today]);
  const trend = useMemo(() => compareToLastMonth(transactions, allocations, month, today), [transactions, allocations, month, today]);
  const todayIso = `${month}-${String(today).padStart(2, '0')}`;
  const recap = useMemo(() => weeklyRecap({ transactions, allocations, buckets, end: todayIso }), [transactions, allocations, buckets, todayIso]);
  // The month-end outlook always leads the Insights card.
  const insights = useMemo(() => {
    const outlook = projectionInsight(forecast, {
      month,
      budgetTotal: buckets.filter((b) => !b.archived).reduce((s, b) => s + b.monthlyLimit, 0),
      previousTotal: trend.previousTotal,
      previousMonthName: new Date(`${previousMonth(month)}-15T12:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
    });
    return [...(outlook ? [outlook] : []), ...findInsights(insightInput)];
  }, [forecast, trend, buckets, month, insightInput]);

  // AI credits. Kept on the phone for the preview; the backend is the source of truth once connected.
  const [credits, setCredits] = useState<CreditState>({ period: month, allowance: PLANS.monthly.monthlyCredits, usedThisMonth: 6, extra: 0 });
  const creditBalance = creditsLeft(credits, month);
  /** Spends credits for an AI action; false when there aren't enough. */
  const useCredits = (reason: CreditReason) => {
    const next = spendCredits(credits, month, CREDIT_COST[reason]);
    if (next) setCredits(next);
    return next !== null;
  };
  /** Mirrors the balance the backend returns with each answer. */
  const syncCredits = (left: { monthly: number; extra: number }) =>
    setCredits((c) => ({ ...c, period: month, usedThisMonth: Math.max(0, c.allowance - left.monthly), extra: left.extra }));
  const addCreditPack = (n: number) => setCredits((c) => ({ ...c, extra: c.extra + n }));

  // Household: members and the accounts each of them linked.
  const [members] = useState<Member[]>(demoMembers);
  const [accounts] = useState<Account[]>(demoAccounts);
  const meId = 'me';
  /** "Sam's Capital One ··9012", or "Your Chase ··5678". */
  const accountLabel = (accountId: string) => {
    const a = accounts.find((x) => x.id === accountId);
    if (!a) return '';
    const owner = a.ownerId === meId ? 'Your' : `${members.find((m) => m.id === a.ownerId)?.name ?? 'Family'}'s`;
    return `${owner} ${a.institution}${a.mask ? ` ··${a.mask}` : ''}`;
  };

  // Patterns from whole past months, and limits that match how the family really spends.
  const tuneUps = useMemo(
    () => budgetTuneUps(buckets, transactions, allocations, month, { spentThisMonth: new Map(statuses.map((s) => [s.bucket.id, s.spent])) }),
    [buckets, transactions, allocations, month, statuses],
  );
  const trends = useMemo(() => bucketTrends(buckets, transactions, allocations, month), [buckets, transactions, allocations, month]);
  const small = useMemo(() => smallPurchases(transactions, month), [transactions, month]);
  const setBucketLimit = (bucketId: string, monthlyLimit: number) =>
    setBuckets((bs) => bs.map((b) => (b.id === bucketId ? { ...b, monthlyLimit } : b)));

  const addBucket = (name: string, monthlyLimit: number) =>
    setBuckets((bs) => [...bs, { id: `custom-${Date.now()}`, name, icon: 'star.fill', monthlyLimit, isCustom: true }]);

  return { month, today, buckets, transactions, allocations, setBillSplit, rules, moveToBucket, goals, addGoal, updateGoal, deleteGoal, statuses, impact, trend, forecast, insights, recap, bills, cutIdeas, tuneUps, trends, small, setBucketLimit, addBucket, credits, creditBalance, useCredits, syncCredits, addCreditPack, members, accounts, meId, accountLabel };
}

type BudgetState = ReturnType<typeof useBudgetState>;
const Ctx = createContext<BudgetState | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useBudgetState()}>{children}</Ctx.Provider>;
}

export function useBudget() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBudget must be used inside BudgetProvider');
  return v;
}
