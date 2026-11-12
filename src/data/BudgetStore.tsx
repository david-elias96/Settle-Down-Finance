import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { bucketStatuses, compareToLastMonth, forecastMonth, projectionInsight, previousMonth, CREDIT_COST, creditsLeft, daysInMonth, findInsights, overspendImpact, PLANS, spendCredits, waysToCut, type Account, type Allocation, type Member, type CreditReason, type CreditState, type Bucket, type SavingsGoal, type GoalFields, reorderGoals, type Transaction, applySplits, vendorKey, type BillSplit, type MerchantRule, type SplitSettings, weeklyRecap, findBills, billsByBucket, billsOutlook, withBills, budgetTuneUps, bucketTrends, smallPurchases, freeToSpend, monthVerdict, monthAhead } from '@/src/domain';
import { useAuth } from '@/src/auth/AuthProvider';
import { backend } from '@/src/lib/backend';
import { demoAccounts, demoAllocations, demoBuckets, demoGoals, demoMembers, demoRules, demoSplits, demoTransactions } from './demo';
import { householdWriter, loadHousehold, type HouseholdSnapshot } from './remote';

/** Nothing yet: a signed-in person before their household's budget has loaded, or with no household. */
const EMPTY: HouseholdSnapshot = { buckets: [], transactions: [], allocations: [], rules: [], goals: [], splits: { byTransaction: {}, byVendor: {} }, members: [], accounts: [], credits: null, bucketUuid: new Map() };
const DEMO: HouseholdSnapshot = { buckets: demoBuckets, transactions: demoTransactions, allocations: demoAllocations, rules: demoRules, goals: demoGoals, splits: demoSplits, members: demoMembers, accounts: demoAccounts, credits: null, bucketUuid: new Map() };

/**
 * App state. Once someone is signed in and belongs to a household, it's that household's real
 * budget from Supabase, and every change is saved back. The sample data is only for development
 * previews without backend settings (Expo Go with no .env); any build connected to the backend
 * starts empty and never shows it.
 */
function useBudgetState() {
  const auth = useAuth();
  const live = !!backend && !!auth.session && !!auth.householdId;
  const userId = auth.session?.user.id ?? null;
  const start = backend ? EMPTY : DEMO;

  const [buckets, setBuckets] = useState<Bucket[]>(start.buckets);
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>(start.transactions);
  const [rawAllocations, setRawAllocations] = useState<Allocation[]>(start.allocations);
  const [rules, setRules] = useState<MerchantRule[]>(start.rules);
  const [splits, setSplits] = useState<SplitSettings>(start.splits);
  const [goals, setGoals] = useState<SavingsGoal[]>(start.goals);
  const [members, setMembers] = useState<Member[]>(start.members);
  const [accounts, setAccounts] = useState<Account[]>(start.accounts);
  const [loading, setLoading] = useState(false);
  /** Shown when loading or saving fails; cleared by the next successful load. */
  const [syncError, setSyncError] = useState<string | null>(null);
  const bucketUuid = useRef(new Map<string, string>());

  const apply = (d: HouseholdSnapshot) => {
    bucketUuid.current = d.bucketUuid;
    setBuckets(d.buckets); setRawTransactions(d.transactions); setRawAllocations(d.allocations); setRules(d.rules);
    setSplits(d.splits); setGoals(d.goals); setMembers(d.members); setAccounts(d.accounts);
    if (d.credits) setCredits(d.credits);
  };

  /** Loads the household's budget again (after linking a bank, on returning to the app, or after a failed save). */
  const reload = useCallback(async () => {
    if (!backend || !auth.householdId || !userId) return;
    setLoading(true);
    try {
      apply(await loadHousehold(backend, auth.householdId, userId));
      setSyncError(null);
    } catch {
      setSyncError("Couldn't load your budget. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.householdId, userId]);

  // Load the household's budget when someone signs in; clear it when they sign out, so the next
  // person on this device never sees it.
  useEffect(() => {
    apply(backend ? EMPTY : DEMO);
    if (live) reload(); else setSyncError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, reload]);

  // New purchases arrive through Plaid while the app is closed, so refresh on coming back.
  useEffect(() => {
    if (!live) return;
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => sub.remove();
  }, [live, reload]);

  const writer = live && backend ? householdWriter(backend, auth.householdId!, (id) => bucketUuid.current.get(id) ?? id) : null;
  /** Saves a change made on screen. If it fails, reloads so the screen shows what's really saved. */
  const save = (work: (w: NonNullable<typeof writer>) => Promise<unknown>) => {
    if (!writer) return;
    work(writer).catch(() => {
      setSyncError("Couldn't save that change. Showing what's saved.");
      reload();
    });
  };

  /**
   * Moves a purchase to another bucket. With `always`, the store gets a rule and its other
   * purchases that weren't placed by hand or by a receipt move too.
   */
  const moveToBucket = (txId: string, bucketId: string, always: boolean) => {
    const tx = rawTransactions.find((t) => t.id === txId);
    if (!tx) return;
    const key = vendorKey(tx.merchant);
    const sameStore = new Set(rawTransactions.filter((t) => vendorKey(t.merchant) === key).map((t) => t.id));
    const all = rawAllocations;
    const movable = (a: Allocation) => a.transactionId === txId
      || (always && sameStore.has(a.transactionId) && a.source !== 'user' && a.source !== 'receipt' && all.filter((b) => b.transactionId === a.transactionId).length === 1);
    const moved = new Set(all.filter(movable).map((a) => a.transactionId));
    const next = all.map((a) => (movable(a) ? { transactionId: a.transactionId, bucketId, amount: a.amount, source: 'user' as const } : a))
      // A receipt split collapses into one bucket.
      .filter((a, i, arr) => a.transactionId !== txId || arr.findIndex((b) => b.transactionId === txId) === i)
      .map((a) => (a.transactionId === txId ? { ...a, amount: tx.amount } : a));
    // A purchase that had no bucket yet gets one.
    if (!next.some((a) => a.transactionId === txId)) { next.push({ transactionId: txId, bucketId, amount: tx.amount, source: 'user' }); moved.add(txId); }
    setRawAllocations(next);
    if (always) setRules((rs) => [...rs.filter((r) => r.match !== key), { match: key, bucketId }]);
    save(async (w) => {
      await w.replaceAllocations([...moved], next);
      if (always) await w.setRule(key, bucketId);
    });
  };
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
    save((w) => w.setBillSplit(txId, key, split, everyCharge));
  };
  /** New goals start as the least protected, so overspending draws from them before older goals. */
  const addGoal = (fields: GoalFields) => {
    const tempId = `goal-${Date.now()}`;
    const priority = Math.max(0, ...goals.map((g) => g.priority)) + 1;
    setGoals((gs) => [...gs, { ...fields, id: tempId, priority }]);
    // Swap the temporary id for the saved one, so later edits reach the right row.
    save(async (w) => {
      const id = await w.addGoal({ ...fields, priority });
      setGoals((gs) => gs.map((g) => (g.id === tempId ? { ...g, id } : g)));
    });
  };
  const updateGoal = (id: string, fields: GoalFields) => {
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...fields } : g)));
    save((w) => w.updateGoal(id, fields));
  };
  const deleteGoal = (id: string) => {
    setGoals((gs) => gs.filter((g) => g.id !== id));
    save((w) => w.deleteGoal(id));
  };
  /** `ids` from most protected to least. Overspending draws from the end of the list first. */
  const setGoalOrder = (ids: string[]) => {
    const next = reorderGoals(goals, ids);
    setGoals(next);
    save((w) => w.setGoalPriorities(next));
  };
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
  // The home screen's one number, its headline, and the path of bills through month end.
  const free = useMemo(() => freeToSpend(statuses, bills.bills, transactions, month, today), [statuses, bills, transactions, month, today]);
  // The same over-limit buckets that the Savings tab counts as overspending.
  const bucketsOver = statuses.filter((st) => st.overBy > 0).length;
  const verdict = useMemo(() => monthVerdict(free, forecast, bucketsOver), [free, forecast, bucketsOver]);
  const ahead = useMemo(() => monthAhead(bills.bills, free, month, today), [bills, free, month, today]);
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

  // AI credits. Signed in, they come from the server (credit_balances) and each answer returns the
  // new balance; only development previews keep them on the phone.
  const [credits, setCredits] = useState<CreditState>({ period: month, allowance: PLANS.monthly.monthlyCredits, usedThisMonth: backend ? 0 : 6, extra: 0 });
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
  /** Preview only: with the backend, credits are only ever added by the server (purchases). */
  const addCreditPack = (n: number) => { if (!backend) setCredits((c) => ({ ...c, extra: c.extra + n })); };

  // Household: members and the accounts each of them linked.
  const meId = live && userId ? userId : 'me';
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
  const setBucketLimit = (bucketId: string, monthlyLimit: number) => {
    setBuckets((bs) => bs.map((b) => (b.id === bucketId ? { ...b, monthlyLimit } : b)));
    save((w) => w.setBucketLimit(bucketId, monthlyLimit));
  };

  const addBucket = (name: string, monthlyLimit: number) => {
    const tempId = `custom-${Date.now()}`;
    setBuckets((bs) => [...bs, { id: tempId, name, icon: 'star.fill', monthlyLimit, isCustom: true }]);
    save(async (w) => {
      const id = await w.addBucket(name, monthlyLimit, 'star.fill', buckets.length + 1);
      bucketUuid.current.set(id, id);
      setBuckets((bs) => bs.map((b) => (b.id === tempId ? { ...b, id } : b)));
    });
  };

  return { live, loading, syncError, reload, month, today, buckets, transactions, allocations, setBillSplit, rules, moveToBucket, goals, addGoal, updateGoal, deleteGoal, setGoalOrder, statuses, impact, trend, forecast, insights, recap, bills, free, verdict, ahead, cutIdeas, tuneUps, trends, small, setBucketLimit, addBucket, credits, creditBalance, useCredits, syncCredits, addCreditPack, members, accounts, meId, accountLabel };
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
