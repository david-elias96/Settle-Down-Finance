import { admin } from './supabase.ts';

/** Sends a push to every member of a household through Expo's push service (which relays to APNs). */
export async function pushToHousehold(householdId: string, msg: { title: string; body: string; data?: Record<string, unknown> }) {
  const { data: members } = await admin.from('household_members').select('user_id').eq('household_id', householdId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return;
  const { data: tokens } = await admin.from('push_tokens').select('expo_push_token').in('user_id', ids);
  const messages = (tokens ?? []).map((t) => ({
    to: t.expo_push_token, title: msg.title, body: msg.body, data: msg.data, sound: 'default',
    categoryId: 'transaction', // iOS action buttons, e.g. "Scan receipt"
  }));
  if (!messages.length) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) console.error('Expo push failed', res.status, await res.text());
}
