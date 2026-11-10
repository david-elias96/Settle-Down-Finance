// Runs on a schedule (e.g. every evening). For each household with smart alerts on, finds
// insights with the shared budget logic, lets Claude pick the one most worth sending and
// word it, and pushes at most one alert per day. On Sundays it sends a weekly summary.
// Protected by a shared secret since it is called by the scheduler, not the app.
import Anthropic from '@anthropic-ai/sdk';
import { admin, handle, HttpError, json } from '../_shared/supabase.ts';
import { loadHousehold } from '../_shared/household.ts';
import { pushToHousehold } from '../_shared/push.ts';
import { requireCronSecret } from '../_shared/security.ts';
import { findInsights, recapFacts, weeklyRecap } from '../_shared/domain/index.ts';

const client = new Anthropic();

const pickSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['insight_id', 'title', 'body'],
  properties: {
    insight_id: { type: ['string', 'null'], description: 'Id of the one insight to send, or null if none is worth an alert today.' },
    title: { type: 'string', description: 'Notification title, max 45 characters.' },
    body: { type: 'string', description: 'Notification body, max 150 characters, using only the numbers given.' },
  },
} as const;

async function word(system: string, facts: unknown): Promise<{ insight_id: string | null; title: string; body: string } | null> {
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: pickSchema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: JSON.stringify(facts) }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((b) => b.type === 'text') as { text: string } | undefined;
  return text ? JSON.parse(text.text) : null;
}

const PICK_SYSTEM = `You write push notifications for a family budgeting app.
You get today's candidate insights (already computed; their numbers are exact) and the kinds
the family recently marked unhelpful. Choose the single insight most useful to act on today, or
null if none is worth interrupting them for. Write a short, friendly, non-judgmental title and
body. Use only numbers present in the input. Add one practical tip when it fits. If you refer to
the app, call it SettleDown.`;

const WEEKLY_SYSTEM = `You write a family's weekly money recap as one push notification.
The facts cover the last 7 days and are exact; use only numbers that appear in them. Lead with
everyday spending against the weekly pace (compare with a typical week when given, since single
weeks are lumpy). Then name the one thing that stood out most: a bucket that jumped, or a win
worth celebrating. Bills are reported apart; mention them only if nothing else stood out.
Friendly, never judgmental, no exclamation marks. If you refer to the app, call it SettleDown.
Set insight_id to null.`;

function inQuietHours(tz: string, start: number, end: number) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

Deno.serve(handle(async (req) => {
  requireCronSecret(req); // fails closed if CRON_SECRET is unset

  const { data: households } = await admin.from('households').select('*').eq('smart_alerts', true);
  const results: Record<string, string> = {};

  for (const hh of households ?? []) {
    if (inQuietHours(hh.timezone, hh.quiet_start, hh.quiet_end)) { results[hh.id] = 'quiet hours'; continue; }

    // At most one smart alert per day.
    const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
    const { count } = await admin.from('insights').select('*', { count: 'exact', head: true })
      .eq('household_id', hh.id).gte('sent_at', since);
    if (count) { results[hh.id] = 'already sent today'; continue; }

    const h = await loadHousehold(hh.id);
    const isSunday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: hh.timezone }).format(new Date()) === 'Sun';

    if (isSunday && hh.weekly_summary) {
      const facts = recapFacts(weeklyRecap({ ...h, end: h.todayIso }));
      const msg = await word(WEEKLY_SYSTEM, facts);
      if (msg) await send(hh.id, { id: `weekly:${h.todayIso}`, kind: 'weekly_summary', facts }, msg);
      results[hh.id] = 'weekly summary';
      continue;
    }

    const { data: sent } = await admin.from('insights').select('insight_key, kind, feedback').eq('household_id', hh.id)
      .gte('sent_at', new Date(Date.now() - 60 * 86400 * 1000).toISOString());
    const sentKeys = new Set((sent ?? []).map((s) => s.insight_key));
    const disliked = [...new Set((sent ?? []).filter((s) => s.feedback === -1).map((s) => s.kind))];
    const candidates = findInsights(h).filter((i) => !sentKeys.has(i.id)).slice(0, 6);
    if (!candidates.length) { results[hh.id] = 'nothing new'; continue; }

    const msg = await word(PICK_SYSTEM, { candidates, recently_unhelpful_kinds: disliked });
    const chosen = candidates.find((c) => c.id === msg?.insight_id);
    if (!msg || !chosen) { results[hh.id] = 'nothing worth sending'; continue; }
    await send(hh.id, { id: chosen.id, kind: chosen.kind, facts: chosen, bucketId: chosen.bucketId }, msg);
    results[hh.id] = `sent ${chosen.kind}`;
  }
  return json({ results });
}));

async function send(
  householdId: string,
  insight: { id: string; kind: string; facts: unknown; bucketId?: string },
  msg: { title: string; body: string },
) {
  const { data: row, error } = await admin.from('insights').insert({
    household_id: householdId, insight_key: insight.id, kind: insight.kind, title: msg.title, body: msg.body, facts: insight.facts,
  }).select('id').single();
  if (error) throw error;
  await pushToHousehold(householdId, {
    title: msg.title, body: msg.body,
    data: { insightId: row.id, bucketId: insight.bucketId, screen: insight.bucketId ? 'bucket' : 'insights' },
  });
}
