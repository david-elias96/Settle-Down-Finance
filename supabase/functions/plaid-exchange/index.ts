// Exchanges the public token from Plaid Link for a long-lived access token, stores it in
// Vault, and records the item's accounts. The first sync happens when Plaid sends its
// SYNC_UPDATES_AVAILABLE webhook.
import { admin, handle, HttpError, json, requireMember } from '../_shared/supabase.ts';
import { plaid, toCents } from '../_shared/plaid.ts';
import { requirePlaidLinkAllowed } from '../_shared/security.ts';

Deno.serve(handle(async (req) => {
  const { householdId, publicToken, institutionName } = await req.json();
  // Each family member links their own banks; record who, so the app can show it.
  const { userId } = await requireMember(req, householdId);
  await requirePlaidLinkAllowed(req, userId);
  if (typeof publicToken !== 'string' || !publicToken.startsWith('public-')) throw new HttpError(400, 'Invalid public token');

  const { access_token, item_id } = await plaid('/item/public_token/exchange', { public_token: publicToken });
  const { data: secretId, error: vaultErr } = await admin.rpc('store_plaid_token', { token: access_token, label: `plaid:${item_id}` });
  if (vaultErr) throw vaultErr;

  const { data: item, error } = await admin.from('plaid_items')
    .insert({ household_id: householdId, plaid_item_id: item_id, access_token_secret_id: secretId, institution_name: institutionName, linked_by: userId })
    .select('id').single();
  if (error) throw error;

  const { accounts } = await plaid('/accounts/get', { access_token });
  await admin.from('accounts').insert(accounts.map((a: any) => ({
    household_id: householdId, plaid_item_id: item.id, plaid_account_id: a.account_id, owner_user_id: userId,
    name: a.official_name ?? a.name, mask: a.mask, type: a.type, subtype: a.subtype,
    backs_savings_goals: a.subtype === 'savings',
    current_balance: a.balances.current == null ? null : toCents(a.balances.current),
  })));

  return json({ ok: true, accounts: accounts.length });
}));
