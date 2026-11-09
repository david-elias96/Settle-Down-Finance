// Runs on a schedule (e.g. every evening). For each household with smart alerts on, finds
// insights with the shared budget logic, lets Claude pick the one most worth sending and
// word it, and pushes at most one alert per day. On Sundays it sends a weekly summary.
// Protected by a shared secret since it is called by the scheduler, not the app.
import Anthropic from '@anthropic-ai/sdk';
import { admin, handle, HttpError, json } from '../_shared/supabase.ts';
import { loadHousehold } from '../_shared/household.ts';
import { pushToHousehold } from '../_shared/push.ts';
import { bucketPace, findInsights, formatCents } from '../_shared/domain/index.ts';

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
body. Use only numbers present in the input. Add one practical tip when it fits.`;

const WEEKLY_SYSTEM = `You write a family's weekly budget summary as one push notification.
Use only the numbers given. Lead with how the month is going overall, then the one bucket that
most needs attention or a win worth celebrating. Friendly and brief. Set insight_id to null.`;

function inQuietHours(tz: string, start: number, end: number) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

Deno.serve(handle(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) throw new HttpError(401, 'Unauthorized');

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
      const spent = h.statuses.reduce((s, b) => s + b.spent, 0);
      const limit = h.statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
      const facts = {
        day_of_month: h.today, days_in_month: h.daysInMonth,
        spent: formatCents(spent), budget: formatCents(limit),
        buckets: h.statuses.map((s) => ({ name: s.bucket.name, ...pick(bucketPace(s, h.today, h.daysInMonth)) })),
      };
      const msg = await word(WEEKLY_SYSTEM, facts);
      if (msg) await send(hh.id, { id: `${h.month}:weekly:${h.today}`, kind: 'weekly_summary', facts }, msg);
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

const pick = (p: ReturnType<typeof bucketPace>) => ({ percent_used: p.percentUsed, status: p.label, detail: p.detail });

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
