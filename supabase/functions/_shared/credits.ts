import { admin, HttpError } from './supabase.ts';
import { requireHouseholdAccess } from './billing.ts';
import { CREDIT_COST, type CreditReason } from './domain/index.ts';

export interface CreditsLeft { monthly: number; extra: number; total: number }

/**
 * Charges the household for one AI action before calling Claude. Throws 402 when
 * they're out. Call `refund` if the AI call then fails, so a failed answer is free.
 */
export async function chargeCredits(householdId: string, reason: CreditReason, ref?: string) {
  const cost = CREDIT_COST[reason];
  // No plan, trial or comp access (once the paywall is on): 402 subscription_required.
  const { comped } = await requireHouseholdAccess(householdId);
  // Founder/family access: unlimited AI, nothing charged or refunded.
  if (comped) {
    const unlimited: CreditsLeft = { monthly: 999, extra: 0, total: 999 };
    return { left: unlimited, refund: async () => unlimited };
  }
  const { data, error } = await admin.rpc('spend_credit', { p_household: householdId, p_cost: cost, p_reason: reason, p_ref: ref ?? null });
  if (error) throw error;
  const row = (data as { ok: boolean; monthly_left: number; extra_left: number }[])[0];
  const left: CreditsLeft = { monthly: row.monthly_left, extra: row.extra_left, total: row.monthly_left + row.extra_left };
  if (!row.ok) throw new HttpError(402, 'out_of_credits', { credits: left });
  return {
    left,
    refund: async () => {
      await admin.rpc('add_credits', { p_household: householdId, p_amount: cost, p_reason: 'refund', p_ref: ref ?? null });
      return { ...left, monthly: left.monthly + cost, total: left.total + cost };
    },
  };
}
