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
