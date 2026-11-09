import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { bucketStatuses, compareToLastMonth, overspendImpact, type Allocation, type Bucket, type SavingsGoal, type Transaction } from '@/src/domain';
import { demoAllocations, demoBuckets, demoGoals, demoTransactions } from './demo';

/**
 * App state. Backed by demo data for now; will be swapped for Supabase queries
 * once the backend is connected, keeping the same shape for screens.
 */
function useBudgetState() {
  const [buckets, setBuckets] = useState<Bucket[]>(demoBuckets);
  const [transactions] = useState<Transaction[]>(demoTransactions);
  const [allocations] = useState<Allocation[]>(demoAllocations);
  const [goals] = useState<SavingsGoal[]>(demoGoals);
  const month = new Date().toISOString().slice(0, 7);

  const statuses = useMemo(() => bucketStatuses(buckets, transactions, allocations, month), [buckets, transactions, allocations, month]);
  const impact = useMemo(() => overspendImpact(statuses, goals), [statuses, goals]);
  const today = new Date().getDate();
  const trend = useMemo(() => compareToLastMonth(transactions, allocations, month, today), [transactions, allocations, month, today]);

  const addBucket = (name: string, monthlyLimit: number) =>
    setBuckets((bs) => [...bs, { id: `custom-${Date.now()}`, name, icon: 'star.fill', monthlyLimit, isCustom: true }]);

  return { month, buckets, transactions, allocations, goals, statuses, impact, trend, addBucket };
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
