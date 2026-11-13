# Paid plans (Stripe)

People subscribe on the web: the website's "Start free trial" buttons go to
`app.settledownfinancial.com/start?plan=…`, they sign in, pick monthly ($5.99, the default) or yearly ($49.99)
in the app's plan picker (`app/plans.tsx`), and pay on Stripe's hosted Checkout page with a 7-day
free trial (card collected up front). Stripe's webhook (`stripe-webhook`) writes the subscription to
`subscriptions`; `my_billing()` and `household_access()` decide access. One plan covers the whole
household. Card details never reach our systems.

Everything ships switched **off**: until you flip `billing_settings.enforced`, everyone keeps full
access, exactly as today.

## Free access (you, family, testers)

Run in the Supabase SQL editor. The person must have signed in to the app once.

```sql
select grant_comp('you@example.com', 'founder');           -- forever, unlimited AI credits
select grant_comp('tester@example.com', 'beta tester', 90); -- 90 days
select revoke_comp('tester@example.com');
```

Free access covers the whole household (a partner in your household gets it too). Nobody can grant
it from the app: the functions are revoked from every app role.

## One-time setup

1. **Stripe account.** Create it at stripe.com with two-step verification on. Do steps 2 to 6 in
   test mode first (toggle top right), then repeat them in live mode.
2. **Products.** Product catalog → add product "Settle Down" with two recurring prices:
   $5.99 monthly and $49.99 yearly. Copy both price ids (`price_…`).
3. **Customer portal.** Settings → Billing → Customer portal: allow cancelling (at period end),
   updating payment methods, viewing invoices, and switching between the two prices.
4. **Trial emails.** Settings → Billing → Subscriptions and emails: turn on "Send a reminder email
   before a free trial ends" and receipts for successful payments.
5. **Restricted key.** Developers → API keys → Create restricted key with **write** on Customers,
   Checkout Sessions, Customer portal and Subscriptions, nothing else.
6. **Webhook.** Developers → Webhooks → Add endpoint
   `https://<your-project>.supabase.co/functions/v1/stripe-webhook`, events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`.
   Copy its signing secret (`whsec_…`).
7. **Supabase edge-function secrets** (Dashboard → Edge Functions → Secrets; never in the repo or the app):
   `STRIPE_SECRET_KEY` (the restricted key), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`,
   `STRIPE_PRICE_YEARLY`. Optional: `APP_WEB_ORIGIN` (defaults to https://app.settledownfinancial.com).
8. **Deploy.** `npx supabase db push`, then deploy `billing-checkout`, `billing-portal`,
   `stripe-webhook` and the updated `plaid-link-token`, `ask`, `receipt-scan`, `cancel-agent`,
   `delete-account` functions. Redeploy the web app (`npm run deploy:web`).
9. **Give yourself free access** (above), then test with card `4242 4242 4242 4242` on a second
   account while still in test mode.

## Launch (turn the paywall on)

1. Switch Stripe to live mode and repeat setup steps 2 to 7 with live ids.
2. Supabase SQL editor: `update billing_settings set enforced = true;`
3. Cloudflare → `settledown-app` → Settings → Variables: add `EARLY_ACCESS=off` (removes the
   early-access password page; the app's own sign-in and plan picker take over). Redeploy.
4. In `site/index.html` change `data-signup="waitlist"` on `<html>` to `data-signup="open"` (the
   "Start free trial" buttons replace the waitlist form), then deploy the website. It ships in
   waitlist mode so deploying it early never sends visitors to the password page.

To go back: `update billing_settings set enforced = false;` gives everyone access again.

## What the paywall blocks

With `enforced` on and no plan, trial or free access: the app opens on the plan picker instead of
the budget, and the backend refuses Plaid Link tokens and AI features (`402 subscription_required`).
Someone whose household partner pays is covered. A failed renewal (`past_due`) keeps access while
Stripe retries.
