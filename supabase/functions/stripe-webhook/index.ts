// Called by Stripe when a checkout finishes or a subscription changes. Verifies the
// Stripe-Signature header (STRIPE_WEBHOOK_SECRET) before reading anything, then re-reads the
// subscription from Stripe and stores its status. Never logs the body (it holds the customer's email).
import { json } from '../_shared/supabase.ts';
import { syncSubscription } from '../_shared/billing.ts';
import { verifyStripeSignature } from '../_shared/stripe.ts';

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await req.text();
  if (raw.length > 512 * 1024) return json({ error: 'Too large' }, 413);
  if (!(await verifyStripeSignature(raw, req.headers.get('Stripe-Signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET')))) {
    return json({ error: 'Bad signature' }, 400);
  }
  let event: { type?: string; data?: { object?: any } };
  try { event = JSON.parse(raw); } catch { return json({ error: 'Bad request' }, 400); }
  if (!event.type || !HANDLED.has(event.type)) return json({ received: true });

  const obj = event.data?.object ?? {};
  const subscriptionId: string | undefined = event.type === 'checkout.session.completed'
    ? (typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id)
    : obj.id;
  if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return json({ received: true });
  try {
    await syncSubscription(subscriptionId);
  } catch (e) {
    console.error('stripe-webhook: sync failed', e instanceof Error ? e.message : 'unknown');
    // 500 makes Stripe retry later.
    return json({ error: 'Retry later' }, 500);
  }
  return json({ received: true });
});
