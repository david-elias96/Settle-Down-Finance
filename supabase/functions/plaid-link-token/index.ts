// Creates a Plaid Link token so the app can open Plaid's bank-login flow.
import { handle, json, requireMember } from '../_shared/supabase.ts';
import { plaid } from '../_shared/plaid.ts';

Deno.serve(handle(async (req) => {
  const { householdId } = await req.json();
  const { userId } = await requireMember(req, householdId);
  const data = await plaid('/link/token/create', {
    user: { client_user_id: userId },
    client_name: 'Family Budget',
    products: ['transactions'],
    transactions: { days_requested: 90 },
    country_codes: ['US'],
    language: 'en',
    webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid-webhook`,
    redirect_uri: Deno.env.get('PLAID_REDIRECT_URI') || undefined,
  });
  return json({ linkToken: data.link_token });
}));
