// Removing Plaid items and deleting a user's data (policy section 8).
import { admin } from './supabase.ts';
import { plaid } from './plaid.ts';

type Item = { id: string; plaid_item_id: string; access_token_secret_id: string };

/**
 * Ends our access to a bank login: tells Plaid to invalidate the access token (/item/remove),
 * deletes the token from Vault, and deletes the item row, which cascades to its accounts,
 * transactions and their bucket allocations.
 */
export async function removePlaidItem(item: Item) {
  const { data: accessToken } = await admin.rpc('read_plaid_token', { secret_id: item.access_token_secret_id });
  if (accessToken) {
    try {
      await plaid('/item/remove', { access_token: accessToken });
    } catch (e) {
      // Already removed at Plaid is fine; anything else must stop us so the token isn't orphaned there.
      if (!String(e).includes('ITEM_NOT_FOUND')) throw e;
    }
  }
  const { error: vaultErr } = await admin.rpc('delete_plaid_token', { secret_id: item.access_token_secret_id });
  if (vaultErr) throw vaultErr;
  const { error } = await admin.from('plaid_items').delete().eq('id', item.id);
  if (error) throw error;
}

/**
 * Deletes everything a user owns: the banks they linked (removed at Plaid), their membership in
 * each household (the household itself when they were its only member, with ownership passed on
 * otherwise), and finally their login. Rows keyed to the user cascade from auth.users.
 */
export async function deleteUserData(userId: string) {
  const { data: items } = await admin.from('plaid_items').select('id, plaid_item_id, access_token_secret_id').eq('linked_by', userId);
  for (const item of items ?? []) await removePlaidItem(item);

  const { data: memberships } = await admin.from('household_members').select('household_id, role').eq('user_id', userId);
  for (const m of memberships ?? []) {
    const { data: others } = await admin.from('household_members').select('user_id, joined_at')
      .eq('household_id', m.household_id).neq('user_id', userId).order('joined_at', { ascending: true });
    if (!others?.length) {
      // Last member: remove any banks still linked here (e.g. by former members), then the household.
      const { data: left } = await admin.from('plaid_items').select('id, plaid_item_id, access_token_secret_id').eq('household_id', m.household_id);
      for (const item of left ?? []) await removePlaidItem(item);
      await admin.from('households').delete().eq('id', m.household_id);
    } else {
      if (m.role === 'owner') {
        await admin.from('household_members').update({ role: 'owner' }).eq('household_id', m.household_id).eq('user_id', others[0].user_id);
      }
      await admin.from('household_members').delete().eq('household_id', m.household_id).eq('user_id', userId);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
