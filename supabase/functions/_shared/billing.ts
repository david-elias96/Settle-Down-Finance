// Paid-plan checks and Stripe subscription bookkeeping. Rules: supabase/migrations/0010_billing.sql.
import { admin, HttpError } from './supabase.ts';
import { planForPrice, stripe } from './stripe.ts';

const STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'];

/**
 * Whether the household may use paid features (Plaid Link, AI). Always true while the paywall
 * switch (billing_settings.enforced) is off. `comped` means founder/family access: no credit charges.
 */
export async function householdAccess(householdId: string): Promise<{ access: boolean; comped: boolean }> {
  const { data, error } = await admin.rpc('household_access', { p_household: householdId });
  if (error) throw error;
  const row = (data as { access: boolean; comped: boolean }[])[0];
  return { access: !!row?.access, comped: !!row?.comped };
}

/** Throws 402 subscription_required when the household has no plan, trial or comp access. */
export async function requireHouseholdAccess(householdId: string) {
  const a = await householdAccess(householdId);
  if (!a.access) throw new HttpError(402, 'subscription_required');
  return a;
}

/** The user's Stripe customer id, created on first checkout (email and our user id only). */
export async function customerFor(userId: string, email: string | undefined): Promise<string> {
  const { data } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await stripe<{ id: string }>('POST', '/customers', { email, metadata: { user_id: userId } }, `customer-${userId}`);
  const { error } = await admin.from('subscriptions').insert({ user_id: userId, stripe_customer_id: customer.id });
  // Two tabs racing: keep whichever row landed first.
  if (error) {
    const again = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).single();
    if (again.error) throw again.error;
    return again.data.stripe_customer_id;
  }
  return customer.id;
}

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

/**
 * Re-reads a subscription from Stripe and stores its current state. Fetching instead of trusting
 * the event body makes retries and out-of-order webhooks harmless.
 */
export async function syncSubscription(subscriptionId: string) {
  const sub = await stripe<any>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  const customerId: string = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const { data: row } = await admin.from('subscriptions').select('user_id, stripe_subscription_id, status').eq('stripe_customer_id', customerId).maybeSingle();
  if (!row) {
    console.warn('stripe-webhook: subscription for an unknown customer, ignored');
    return;
  }
  // A customer has one live subscription. Don't let a stale, ended one overwrite a newer live one.
  const live = ['trialing', 'active', 'past_due'];
  if (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id && live.includes(row.status) && !live.includes(sub.status)) return;

  const item = sub.items?.data?.[0];
  const { error } = await admin.from('subscriptions').update({
    stripe_subscription_id: sub.id,
    status: STATUSES.includes(sub.status) ? sub.status : 'none',
    plan: planForPrice(item?.price?.id),
    trial_end: ts(sub.trial_end),
    current_period_end: ts(item?.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    had_subscription: true,
    updated_at: new Date().toISOString(),
  }).eq('user_id', row.user_id);
  if (error) throw error;
}

/**
 * Account deletion (policy section 8): cancels any live subscription right away so nobody is
 * charged after their account is gone. The subscriptions row goes with the auth user (cascade).
 * Stripe keeps its own payment records as the law requires; see the data retention policy.
 */
export async function cancelBillingForUser(userId: string) {
  const { data } = await admin.from('subscriptions').select('stripe_subscription_id, status').eq('user_id', userId).maybeSingle();
  if (!data?.stripe_subscription_id || ['canceled', 'incomplete_expired'].includes(data.status)) return;
  try {
    await stripe('DELETE', `/subscriptions/${encodeURIComponent(data.stripe_subscription_id)}`);
  } catch (e) {
    // Already gone at Stripe is fine; anything else must stop the deletion so we can retry.
    if (!String(e).includes('404')) throw e;
  }
}
