import type { BucketStatus } from './budget';
import type { Cents, SavingsGoal } from './types';

export interface GoalImpact {
  goal: SavingsGoal;
  /** Amount pulled from this goal's envelope to cover overspending. */
  drawn: Cents;
  balanceAfter: Cents;
  /** Extra months needed to reach the target at the current contribution. */
  monthsDelayed: number;
}

export interface OverspendImpact {
  /** Sum of all over-limit amounts across buckets. */
  totalOverspend: Cents;
  /** Unspent room in other buckets, used before touching savings. */
  coveredByOtherBuckets: Cents;
  /** What lands on savings goals after slack is used. */
  hitsSavings: Cents;
  goals: GoalImpact[];
  /** Overspend that even the savings goals couldn't absorb. */
  uncovered: Cents;
}

/**
 * Shows how this month's overspending affects savings goals.
 *
 * Order: first use unspent room in other buckets (if the household allows it),
 * then draw from goals starting with the least-protected (highest priority number).
 */
export function overspendImpact(
  statuses: BucketStatus[],
  goals: SavingsGoal[],
  opts: { useOtherBucketSlack: boolean } = { useOtherBucketSlack: true },
): OverspendImpact {
  const totalOverspend = statuses.reduce((s, b) => s + b.overBy, 0);
  const slack = statuses.reduce((s, b) => s + Math.max(0, b.remaining), 0);
  const coveredByOtherBuckets = opts.useOtherBucketSlack ? Math.min(slack, totalOverspend) : 0;
  let need = totalOverspend - coveredByOtherBuckets;
  const hitsSavings = need;

  const ordered = [...goals].sort((a, b) => b.priority - a.priority);
  const impacts: GoalImpact[] = ordered.map((goal) => {
    const drawn = Math.min(need, Math.max(0, goal.balance));
    need -= drawn;
    return {
      goal,
      drawn,
      balanceAfter: goal.balance - drawn,
      monthsDelayed: drawn > 0 && goal.monthlyContribution > 0 ? Math.ceil(drawn / goal.monthlyContribution) : 0,
    };
  });

  return {
    totalOverspend,
    coveredByOtherBuckets,
    hitsSavings,
    goals: impacts.sort((a, b) => a.goal.priority - b.goal.priority),
    uncovered: need,
  };
}

/** When a goal will be reached at its monthly contribution, and whether that beats its target date. */
export function goalForecast(goal: SavingsGoal, balance: Cents, fromMonth: string): { finish: string | null; finishLabel: string; onTime: boolean | null } {
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (balance >= goal.target) return { finish: fromMonth, finishLabel: 'Reached', onTime: true };
  if (goal.monthlyContribution <= 0) return { finish: null, finishLabel: 'No monthly amount set', onTime: goal.targetDate ? false : null };
  const months = Math.ceil((goal.target - balance) / goal.monthlyContribution);
  const [y, m] = fromMonth.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  const finish = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  return {
    finish,
    finishLabel: `${short[idx % 12]} ${Math.floor(idx / 12)}`,
    onTime: goal.targetDate ? finish <= goal.targetDate.slice(0, 7) : null,
  };
}
