// Opens Stripe's customer portal so a subscriber can change plan, update their card, see
// invoices or cancel. Stripe hosts it; we only hand over the customer id.
import { admin, handle, HttpError, json } from '../_shared/supabase.ts';
import { requireUser } from '../_shared/security.ts';
import { stripe } from '../_shared/stripe.ts';

const APP = Deno.env.get('APP_WEB_ORIGIN') ?? 'https://app.settledownfinancial.com';

Deno.serve(handle(async (req) => {
  const { userId } = await requireUser(req);
  const { data } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (!data?.stripe_customer_id) throw new HttpError(404, 'No billing account yet');
  const session = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer: data.stripe_customer_id, return_url: `${APP}/plans` });
  return json({ url: session.url });
}));
