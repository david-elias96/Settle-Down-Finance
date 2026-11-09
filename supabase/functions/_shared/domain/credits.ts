/**
 * AI credits. Each plan includes a monthly allowance that resets on the 1st (unused
 * credits don't carry over). Extra packs bought in the app never expire and are used
 * only after the monthly allowance runs out. The database function `spend_credit`
 * follows the same rules; these helpers drive the app and the tests.
 */
export type CreditReason = 'ask' | 'receipt_scan' | 'cancel_agent';

/**
 * What each AI action costs. Daily insights and the weekly summary are free. Cancelling
 * a subscription with the agent takes many steps, so it costs more (refunded if it fails).
 */
export const CREDIT_COST: Record<CreditReason, number> = { ask: 1, receipt_scan: 1, cancel_agent: 5 };

export const PLANS = {
  monthly: { label: 'Monthly', price: '$5.99/month', monthlyCredits: 40 },
  yearly: { label: 'Yearly', price: '$49.99/year', monthlyCredits: 40 },
} as const;

export const CREDIT_PACK = { credits: 25, price: '$1.99' } as const;

export interface CreditState {
  /** Month the allowance applies to, YYYY-MM. */
  period: string;
  allowance: number;
  usedThisMonth: number;
  /** Purchased credits; roll over month to month. */
  extra: number;
}

export function creditsLeft(s: CreditState, month: string) {
  const used = s.period === month ? s.usedThisMonth : 0;
  const monthly = Math.max(0, s.allowance - used);
  return { monthly, extra: s.extra, total: monthly + s.extra };
}

/** Returns the new state, or null when there aren't enough credits. */
export function spendCredits(s: CreditState, month: string, cost: number): CreditState | null {
  const base = s.period === month ? s : { ...s, period: month, usedThisMonth: 0 };
  const left = creditsLeft(base, month);
  if (left.total < cost) return null;
  const fromMonthly = Math.min(cost, left.monthly);
  return { ...base, usedThisMonth: base.usedThisMonth + fromMonthly, extra: base.extra - (cost - fromMonthly) };
}

/** "Dec 1": when the monthly allowance resets. */
export function creditsResetLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
