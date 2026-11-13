/**
 * Paid plans. People subscribe on the web (Stripe Checkout) with a free trial; the database
 * function my_billing() reports whether the signed-in person has access. These helpers turn
 * that into what the app shows, and read the plan a visitor picked on the website.
 */
export type PlanId = 'monthly' | 'yearly';

/** Saved setting: the plan picked on the website, kept across sign-in so it comes back preselected. */
export const CHOSEN_PLAN = 'chosen-plan';

export const PLAN_PRICES: Record<PlanId, { label: string; price: string; per: string; note: string }> = {
  monthly: { label: 'Monthly', price: '$5.99', per: 'month', note: 'Cancel anytime' },
  yearly: { label: 'Yearly', price: '$49.99', per: 'year', note: 'About $4.17 a month, save 30%' },
};

/** Why someone has access: a comp (founder/family), their own plan, a household member's plan, or the paywall is off. */
export type AccessReason = 'comp' | 'subscribed' | 'household' | 'open' | 'none';

export interface BillingState {
  access: boolean;
  reason: AccessReason;
  enforced: boolean;
  status: string;
  plan: PlanId | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialDays: number;
  canTrial: boolean;
}

/** Plan from a website link like /plans?plan=monthly. Anything else picks the yearly plan. */
export function parsePlan(value: unknown): PlanId {
  return value === 'monthly' ? 'monthly' : 'yearly';
}

/** Turns a my_billing() row into app state. Missing or odd values fail closed (no access). */
export function billingFromRow(row: Record<string, unknown> | null | undefined): BillingState | null {
  if (!row) return null;
  const reasons: AccessReason[] = ['comp', 'subscribed', 'household', 'open', 'none'];
  const reason = reasons.includes(row.reason as AccessReason) ? (row.reason as AccessReason) : 'none';
  return {
    access: row.access === true && reason !== 'none',
    reason,
    enforced: row.enforced === true,
    status: typeof row.status === 'string' ? row.status : 'none',
    plan: row.plan === 'monthly' || row.plan === 'yearly' ? row.plan : null,
    trialEnd: typeof row.trial_end === 'string' ? row.trial_end : null,
    currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    trialDays: typeof row.trial_days === 'number' ? row.trial_days : 0,
    canTrial: row.can_trial === true,
  };
}

/** Whole days left until `iso`, never negative. */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 864e5));
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** One line for Settings and the plans screen: what the person has and what happens next. */
export function billingSummary(b: BillingState, now = new Date()): { title: string; detail: string } {
  if (b.reason === 'comp') return { title: 'Founder access', detail: 'Everything included, unlimited AI. No charge.' };
  if (b.reason === 'household') return { title: 'Covered by your household', detail: 'Someone in your household has a plan, so you have everything too.' };
  const plan = b.plan ? PLAN_PRICES[b.plan] : null;
  if (b.status === 'trialing' && b.trialEnd) {
    const left = daysUntil(b.trialEnd, now);
    return {
      title: `Free trial · ${left} ${left === 1 ? 'day' : 'days'} left`,
      detail: b.cancelAtPeriodEnd
        ? `Ends ${shortDate(b.trialEnd)}. You won't be charged.`
        : `${plan ? `${plan.label} plan starts ${shortDate(b.trialEnd)} at ${plan.price}/${plan.per}.` : `Ends ${shortDate(b.trialEnd)}.`} Cancel before then and you pay nothing.`,
    };
  }
  if (b.status === 'active' || b.status === 'past_due') {
    const when = b.currentPeriodEnd ? shortDate(b.currentPeriodEnd) : null;
    if (b.status === 'past_due') return { title: 'Payment didn’t go through', detail: 'Update your card to keep your plan. We’ll retry for a few days.' };
    return {
      title: plan ? `${plan.label} plan · ${plan.price}/${plan.per}` : 'Subscribed',
      detail: b.cancelAtPeriodEnd ? `Cancelled. Access until ${when ?? 'the end of this period'}.` : when ? `Renews ${when}.` : 'Active.',
    };
  }
  if (b.reason === 'open') return { title: 'Early access', detail: 'Paid plans aren’t switched on yet, so everything is free for now.' };
  return { title: 'No plan yet', detail: b.canTrial ? `Start a ${b.trialDays}-day free trial to use Settle Down.` : 'Pick a plan to keep using Settle Down.' };
}

/** Whether the person should be sent to the plan picker instead of the app. */
export function needsPlan(b: BillingState | null): boolean {
  return !!b && b.enforced && !b.access;
}
