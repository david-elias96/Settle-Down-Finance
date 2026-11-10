// Unlinks a bank: removes the item at Plaid, deletes its token from Vault, and deletes its
// accounts and transactions (policy section 8). Only the person who linked it may unlink it.
import { admin, handle, HttpError, json, requireMember } from '../_shared/supabase.ts';
import { removePlaidItem } from '../_shared/plaidItems.ts';

Deno.serve(handle(async (req) => {
  const { householdId, itemId } = await req.json();
  if (typeof itemId !== 'string') throw new HttpError(400, 'itemId is required');
  const { userId } = await requireMember(req, householdId);
  const { data: item } = await admin.from('plaid_items').select('id, plaid_item_id, access_token_secret_id, linked_by')
    .eq('id', itemId).eq('household_id', householdId).maybeSingle();
  if (!item) throw new HttpError(404, 'Bank not found');
  if (item.linked_by && item.linked_by !== userId) throw new HttpError(403, 'Only the person who linked this bank can unlink it');
  await removePlaidItem(item);
  return json({ ok: true });
}));
