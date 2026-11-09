// Exchanges the public token from Plaid Link for a long-lived access token, stores it in
// Vault, and records the item's accounts. The first sync happens when Plaid sends its
// SYNC_UPDATES_AVAILABLE webhook.
import { admin, handle, json, requireMember } from '../_shared/supabase.ts';
import { plaid, toCents } from '../_shared/plaid.ts';

Deno.serve(handle(async (req) => {
  const { householdId, publicToken, institutionName } = await req.json();
  await requireMember(req, householdId);

  const { access_token, item_id } = await plaid('/item/public_token/exchange', { public_token: publicToken });
  const { data: secretId, error: vaultErr } = await admin.rpc('store_plaid_token', { token: access_token, label: `plaid:${item_id}` });
  if (vaultErr) throw vaultErr;

  const { data: item, error } = await admin.from('plaid_items')
    .insert({ household_id: householdId, plaid_item_id: item_id, access_token_secret_id: secretId, institution_name: institutionName })
    .select('id').single();
  if (error) throw error;

  const { accounts } = await plaid('/accounts/get', { access_token });
  await admin.from('accounts').insert(accounts.map((a: any) => ({
    household_id: householdId, plaid_item_id: item.id, plaid_account_id: a.account_id,
    name: a.official_name ?? a.name, mask: a.mask, type: a.type, subtype: a.subtype,
    backs_savings_goals: a.subtype === 'savings',
    current_balance: a.balances.current == null ? null : toCents(a.balances.current),
  })));

  return json({ ok: true, accounts: accounts.length });
}));
