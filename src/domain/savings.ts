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

/** The fields a person can set on a goal. Balance is what's already set aside for it. */
export type GoalFields = Pick<SavingsGoal, 'name' | 'target' | 'balance' | 'monthlyContribution' | 'targetDate'>;

/** What the goal form holds while someone types. All text, straight from the inputs. */
export interface GoalDraft {
  name: string;
  target: string;
  saved: string;
  monthly: string;
  /** Optional target month, typed as "6/2027", "06/27", "Jun 2027" or "2027-06". */
  targetMonth: string;
}

export const GOAL_NAME_MAX = 40;
const GOAL_AMOUNT_MAX = 10_000_000_00;
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "$1,250.50" → 125050 cents. Empty → 0. Anything else unreadable → null. */
export function parseMoney(s: string): Cents | null {
  const clean = s.replace(/[$,\s]/g, '');
  if (clean === '') return 0;
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === '.') return null;
  return Math.round(Number(clean) * 100);
}

/** Reads a typed month into "YYYY-MM", or null when it isn't one. */
export function parseMonth(s: string): string | null {
  const v = s.trim().toLowerCase();
  let y: number, m: number;
  let match: RegExpMatchArray | null;
  if ((match = v.match(/^(\d{4})-(\d{1,2})$/))) { y = Number(match[1]); m = Number(match[2]); }
  else if ((match = v.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/))) { m = Number(match[1]); y = Number(match[2]); }
  else if ((match = v.match(/^([a-z]+)\.?,?\s+(\d{2}|\d{4})$/))) {
    m = MONTH_NAMES.findIndex((n) => match![1].startsWith(n)) + 1;
    if (m === 0 || match[1].length < 3) return null;
    y = Number(match[2]);
  } else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || y < 2000 || y > 2200) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** "2027-06-01" → "06/2027", for putting a saved goal back into the form. */
export const monthInputValue = (targetDate?: string) => (targetDate ? `${targetDate.slice(5, 7)}/${targetDate.slice(0, 4)}` : '');

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/**
 * The monthly amount that reaches `target` by the target month, counting the same way
 * `goalForecast` does. 0 when already reached.
 */
export function monthlyNeeded(target: Cents, balance: Cents, targetMonth: string, fromMonth: string): Cents {
  const left = target - balance;
  if (left <= 0) return 0;
  const months = Math.max(1, monthIndex(targetMonth) - monthIndex(fromMonth));
  // Round up to whole dollars so the forecast lands on or before the target month.
  return Math.ceil(left / months / 100) * 100;
}

/** Checks the form and turns it into goal fields, or explains the first problem in plain words. */
export function parseGoalDraft(d: GoalDraft, thisMonth: string): { ok: true; goal: GoalFields } | { ok: false; error: string } {
  const name = d.name.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Give the goal a name.' };
  if (name.length > GOAL_NAME_MAX) return { ok: false, error: `Keep the name under ${GOAL_NAME_MAX} characters.` };
  const target = parseMoney(d.target);
  if (target === null || target <= 0) return { ok: false, error: 'Enter how much you want to save.' };
  const balance = parseMoney(d.saved);
  if (balance === null) return { ok: false, error: 'Enter what you have saved so far as an amount, like 250.' };
  const monthly = parseMoney(d.monthly);
  if (monthly === null) return { ok: false, error: 'Enter the monthly amount as a number, like 100.' };
  if (target > GOAL_AMOUNT_MAX || balance > GOAL_AMOUNT_MAX || monthly > GOAL_AMOUNT_MAX) return { ok: false, error: 'That amount is too large.' };
  let targetDate: string | undefined;
  if (d.targetMonth.trim()) {
    const ym = parseMonth(d.targetMonth);
    if (!ym) return { ok: false, error: 'Enter the target date as month and year, like 06/2027.' };
    if (ym < thisMonth) return { ok: false, error: 'The target date has already passed.' };
    targetDate = `${ym}-01`;
  }
  return { ok: true, goal: { name, target, balance, monthlyContribution: monthly, targetDate } };
}
