// "Delete my account" in Settings (policy section 8). Removes the user's banks at Plaid,
// deletes their Vault tokens and data, leaves or deletes their households, then the login.
import { handle, HttpError, json } from '../_shared/supabase.ts';
import { requireUser } from '../_shared/security.ts';
import { deleteUserData } from '../_shared/plaidItems.ts';

Deno.serve(handle(async (req) => {
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'DELETE') throw new HttpError(400, 'Confirmation required');
  const { userId } = await requireUser(req);
  await deleteUserData(userId);
  return json({ ok: true });
}));
