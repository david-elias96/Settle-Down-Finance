// "Ask" box: answers questions like "How can I cut my spending this month?" using
// Claude with read-only tools over the household's budget. All numbers come from the
// tools (computed by the shared budget logic), never from the model's arithmetic.
import Anthropic from '@anthropic-ai/sdk';
import { handle, HttpError, json, requireMember } from '../_shared/supabase.ts';
import { loadHousehold, type HouseholdData } from '../_shared/household.ts';
import { chargeCredits } from '../_shared/credits.ts';
import {
  bucketPace, filterTransactions, findInsights, findSubscriptions, formatCents, monthLabel, vendorKey, waysToCut,
} from '../_shared/domain/index.ts';

const client = new Anthropic();
const MAX_TURNS = 8;

const SYSTEM = `You are the assistant inside Settle Down Finance, a family budgeting app.
Answer questions about the family's own spending, budget buckets, and savings.

- Use the tools for every number. Never estimate or do your own arithmetic on amounts; if a tool doesn't give a figure, say you don't have it.
- Be brief and practical: a one-sentence answer first, then at most 4 short bullets. Plain language, no jargon.
- For "how can I cut/save" questions, start from get_ways_to_cut and name specific buckets, stores, and dollar amounts.
- Be encouraging, never judgmental. Don't give investment, tax, or legal advice; suggest a professional for those.
- Money is US dollars. Today is day {TODAY} of {MONTH}.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_budget_overview',
    description: "This month's buckets: limit, spent, left, percent used and pace status (On track / Under pace / Over pace / Over budget) with a month-end projection.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_ways_to_cut',
    description: 'Ranked, concrete ways to spend less this month (buckets heading over, biggest optional stores, subscriptions), each with an estimated saving.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_insights',
    description: 'Current alerts: over-budget or at-risk buckets, unusually high spending at a store, subscription price increases.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'find_transactions',
    description: 'Transactions filtered by month, bucket and/or store, with a total. Use for questions like "how much at Costco since September".',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        months: { type: 'array', items: { type: 'string', description: 'YYYY-MM' }, description: 'Months to include; omit for all loaded months (about 4).' },
        bucket: { type: 'string', description: 'Bucket name, e.g. "Dining Out".' },
        vendor: { type: 'string', description: 'Store name, e.g. "Target".' },
        limit: { type: 'integer', description: 'Max transactions to list (default 15). The total always covers all matches.' },
      },
    },
  },
  {
    name: 'get_monthly_totals',
    description: 'Spending per bucket for each loaded month, to compare months or spot trends.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_subscriptions',
    description: 'Recurring monthly charges detected from the transactions, with current and previous amounts.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function runTool(name: string, input: Record<string, unknown>, h: HouseholdData): unknown {
  const $ = (c: number) => formatCents(c);
  switch (name) {
    case 'get_budget_overview':
      return h.statuses.map((s) => {
        const p = bucketPace(s, h.today, h.daysInMonth);
        return { bucket: s.bucket.name, limit: $(s.bucket.monthlyLimit), spent: $(s.spent), left: $(s.remaining),
          percent_used: p.percentUsed, status: p.label, projected_month_end: $(p.projectedTotal) };
      });
    case 'get_ways_to_cut':
      return waysToCut(h, h.bucketName).map((i) => ({ ...i, saving: $(i.saving) }));
    case 'get_insights':
      return findInsights(h).map(({ title, body, kind }) => ({ kind, title, body }));
    case 'get_subscriptions':
      return findSubscriptions(h.transactions).map((s) => ({ store: s.vendor, amount: $(s.amount), previous: $(s.previousAmount), last_charged: s.lastDate }));
    case 'get_monthly_totals': {
      const out: Record<string, Record<string, string>> = {};
      const sums = new Map<string, Map<string, number>>();
      const dateOf = new Map(h.transactions.map((t) => [t.id, t.date.slice(0, 7)]));
      for (const a of h.allocations) {
        const m = dateOf.get(a.transactionId); if (!m) continue;
        const row = sums.get(m) ?? new Map(); row.set(a.bucketId, (row.get(a.bucketId) ?? 0) + a.amount); sums.set(m, row);
      }
      for (const [m, row] of [...sums].sort()) {
        out[monthLabel(m)] = Object.fromEntries([...row].map(([b, c]) => [h.bucketName(b), $(c)]));
        out[monthLabel(m)].TOTAL = $([...row.values()].reduce((s, c) => s + c, 0));
      }
      return out;
    }
    case 'find_transactions': {
      const months = (input.months as string[] | undefined) ?? null;
      const bucket = input.bucket ? h.buckets.find((b) => b.name.toLowerCase() === String(input.bucket).toLowerCase()) : null;
      if (input.bucket && !bucket) return { error: `No bucket named "${input.bucket}". Buckets: ${h.buckets.map((b) => b.name).join(', ')}` };
      const vendor = input.vendor ? vendorKey(String(input.vendor)) : null;
      const matches = (months ?? [null]).flatMap((m) =>
        filterTransactions(h.transactions, h.allocations, { month: m, bucketId: bucket?.id ?? null, vendor: null }).items)
        .filter((i) => !vendor || vendorKey(i.tx.merchant).includes(vendor));
      const limit = Math.min(50, Number(input.limit ?? 15));
      return {
        count: matches.length,
        total: $(matches.reduce((s, i) => s + i.amount, 0)),
        transactions: matches.slice(0, limit).map((i) => ({ date: i.tx.date, store: i.tx.merchant, amount: $(i.amount),
          buckets: i.parts.map((p) => h.bucketName(p.bucketId)).join(' + ') })),
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

Deno.serve(handle(async (req) => {
  const { householdId, question, history = [] } = await req.json();
  await requireMember(req, householdId);
  if (typeof question !== 'string' || !question.trim()) throw new HttpError(400, 'question is required');
  if (question.length > 1000) throw new HttpError(400, 'Question is too long');

  // One credit per question, charged up front and refunded if no answer comes back.
  const credit = await chargeCredits(householdId, 'ask', crypto.randomUUID());
  try {
    return json({ answer: await answer(householdId, question, history), credits: credit.left });
  } catch (e) {
    const credits = await credit.refund();
    if (e instanceof HttpError) throw new HttpError(e.status, e.message, { credits });
    throw e;
  }
}));

async function answer(householdId: string, question: string, history: unknown[]): Promise<string> {
  const h = await loadHousehold(householdId);
  // Earlier turns are passed back as plain text so follow-ups ("what about last month?") work.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(history as { role: 'user' | 'assistant'; text: string }[]).slice(-6).map((m) => ({ role: m.role, content: m.text })),
    { role: 'user', content: question.trim() },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM.replace('{TODAY}', String(h.today)).replace('{MONTH}', monthLabel(h.month)),
      tools,
      messages,
    });

    if (response.stop_reason === 'refusal') return "Sorry, I can't help with that one. Try asking about your spending or budget.";
    if (response.stop_reason !== 'tool_use') {
      return response.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n').trim();
    }

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(runTool(b.name, b.input as Record<string, unknown>, h)) }));
    messages.push({ role: 'user', content: results });
  }
  return 'That question needed more steps than I can take at once. Try asking something narrower.';
}
