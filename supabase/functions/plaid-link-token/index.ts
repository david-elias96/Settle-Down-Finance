// Creates a Plaid Link token so the app can open Plaid's bank-login flow.
// Policy: Link is only surfaced after a second factor (AAL2) and consent to the data-use notice.
import { handle, json, requireMember } from '../_shared/supabase.ts';
import { plaid } from '../_shared/plaid.ts';
import { requirePlaidLinkAllowed } from '../_shared/security.ts';
import { PLAID_HISTORY_DAYS } from '../_shared/domain/index.ts';

Deno.serve(handle(async (req) => {
  const { householdId, web } = await req.json();
  const { userId } = await requireMember(req, householdId);
  await requirePlaidLinkAllowed(req, userId);
  const data = await plaid('/link/token/create', {
    user: { client_user_id: userId },
    client_name: 'Settle Down Finance',
    products: ['transactions'],
    transactions: { days_requested: PLAID_HISTORY_DAYS },
    country_codes: ['US'],
    language: 'en',
    webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid-webhook`,
    // Banks that use OAuth return to this page: the web app's /connect-bank, or the iOS app's link.
    redirect_uri: (web === true ? Deno.env.get('PLAID_WEB_REDIRECT_URI') : Deno.env.get('PLAID_REDIRECT_URI')) || undefined,
  });
  return json({ linkToken: data.link_token });
}));
