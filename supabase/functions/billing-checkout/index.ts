// Starts a Stripe Checkout session for the web app's plan picker. The person pays on Stripe's
// hosted page; we never see card details. A first subscription gets the free trial
// (billing_settings.trial_days), with the card collected up front and a reminder from Stripe
// before the first charge.
import { admin, handle, HttpError, json } from '../_shared/supabase.ts';
import { requireUser } from '../_shared/security.ts';
import { customerFor } from '../_shared/billing.ts';
import { priceFor, stripe } from '../_shared/stripe.ts';

const APP = Deno.env.get('APP_WEB_ORIGIN') ?? 'https://app.settledownfinancial.com';

Deno.serve(handle(async (req) => {
  const { plan } = await req.json().catch(() => ({}));
  if (plan !== 'monthly' && plan !== 'yearly') throw new HttpError(400, 'Pick a plan');
  const { userId } = await requireUser(req);

  const { data: existing } = await admin.from('subscriptions').select('status, had_subscription').eq('user_id', userId).maybeSingle();
  if (existing && ['trialing', 'active', 'past_due'].includes(existing.status)) throw new HttpError(409, 'already_subscribed');
  const { data: settings } = await admin.from('billing_settings').select('trial_days').single();
  const trialDays = existing?.had_subscription ? 0 : settings?.trial_days ?? 0;

  const { data: user } = await admin.auth.admin.getUserById(userId);
  const customer = await customerFor(userId, user.user?.email ?? undefined);

  const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceFor(plan), quantity: 1 }],
    allow_promotion_codes: true,
    payment_method_collection: 'always',
    subscription_data: {
      metadata: { user_id: userId },
      ...(trialDays > 0 ? {
        trial_period_days: trialDays,
        // No card on file when the trial ends: cancel instead of leaving an unpaid subscription.
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      } : {}),
    },
    success_url: `${APP}/plans?checkout=success`,
    cancel_url: `${APP}/plans?checkout=canceled`,
  });
  return json({ url: session.url });
}));
