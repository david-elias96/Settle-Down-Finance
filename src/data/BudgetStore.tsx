import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { bucketStatuses, compareToLastMonth, forecastMonth, projectionInsight, previousMonth, CREDIT_COST, creditsLeft, daysInMonth, findInsights, overspendImpact, PLANS, spendCredits, waysToCut, type Account, type Allocation, type Member, type CreditReason, type CreditState, type Bucket, type SavingsGoal, type Transaction, applySplits, vendorKey, type BillSplit, type SplitSettings, weeklyRecap } from '@/src/domain';
import { demoAccounts, demoAllocations, demoBuckets, demoGoals, demoMembers, demoSplits, demoTransactions } from './demo';

/**
 * App state. Backed by demo data for now; will be swapped for Supabase queries
 * once the backend is connected, keeping the same shape for screens.
 */
function useBudgetState() {
  const [buckets, setBuckets] = useState<Bucket[]>(demoBuckets);
  const [rawTransactions] = useState<Transaction[]>(demoTransactions);
  const [rawAllocations] = useState<Allocation[]>(demoAllocations);
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
  const [goals] = useState<SavingsGoal[]>(demoGoals);
  const month = new Date().toISOString().slice(0, 7);

  const statuses = useMemo(() => bucketStatuses(buckets, transactions, allocations, month), [buckets, transactions, allocations, month]);
  const impact = useMemo(() => overspendImpact(statuses, goals), [statuses, goals]);
  const today = new Date().getDate();
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

  const addBucket = (name: string, monthlyLimit: number) =>
    setBuckets((bs) => [...bs, { id: `custom-${Date.now()}`, name, icon: 'star.fill', monthlyLimit, isCustom: true }]);

  return { month, today, buckets, transactions, allocations, setBillSplit, goals, statuses, impact, trend, forecast, insights, recap, cutIdeas, addBucket, credits, creditBalance, useCredits, syncCredits, addCreditPack, members, accounts, meId, accountLabel };
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
