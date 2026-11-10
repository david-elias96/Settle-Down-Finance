// Daily retention job (policy section 8), called by the scheduler with CRON_SECRET.
// - Clears the cancel assistant's page text after 30 days, keeping the outcome.
// - Warns inactive users 30 days before the 24-month mark, then deletes their account.
import { admin, handle, json } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/security.ts';
import { deleteUserData } from '../_shared/plaidItems.ts';
import { inactiveAccountAction, RETENTION } from '../_shared/domain/index.ts';

Deno.serve(handle(async (req) => {
  requireCronSecret(req);
  const now = new Date();

  const cutoff = new Date(now.getTime() - RETENTION.cancelConversationDays * 86_400_000).toISOString();
  const { count: cleared } = await admin.from('cancel_sessions').update({ messages: [] }, { count: 'exact' })
    .lt('created_at', cutoff).neq('messages', '[]');

  // Anyone whose last sign-in is inside the notice window or older.
  const windowStart = new Date(now);
  windowStart.setUTCMonth(windowStart.getUTCMonth() - RETENTION.inactiveAccountMonths);
  windowStart.setUTCDate(windowStart.getUTCDate() + RETENTION.inactiveNoticeDays + 1);
  const { data: inactive, error } = await admin.rpc('inactive_users', { before: windowStart.toISOString() });
  if (error) throw error;

  let warned = 0, deleted = 0;
  for (const u of inactive ?? []) {
    const { data: notice } = await admin.from('retention_notices').select('warned_at').eq('user_id', u.user_id).maybeSingle();
    const action = inactiveAccountAction(new Date(u.last_sign_in_at), notice ? new Date(notice.warned_at) : null, now);
    if (action === 'warn') {
      await pushToUser(u.user_id, 'Your Settle Down account will be deleted',
        `You haven't opened Settle Down in almost ${RETENTION.inactiveAccountMonths} months. Sign in within ${RETENTION.inactiveNoticeDays} days to keep your account.`);
      await admin.from('retention_notices').upsert({ user_id: u.user_id, warned_at: now.toISOString() });
      warned++;
    } else if (action === 'delete') {
      await deleteUserData(u.user_id);
      deleted++;
    }
  }
  return json({ ok: true, clearedConversations: cleared ?? 0, warned, deleted });
}));

async function pushToUser(userId: string, title: string, body: string) {
  const { data: tokens } = await admin.from('push_tokens').select('expo_push_token').eq('user_id', userId);
  if (!tokens?.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
    },
    body: JSON.stringify(tokens.map((t) => ({ to: t.expo_push_token, title, body, sound: 'default' }))),
  });
}
