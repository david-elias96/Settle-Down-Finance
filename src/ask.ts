import { answerToText, bucketPace, previousMonth, topStores, shortDate, daysInMonth, findSubscriptions, formatCents, type AskAnswer, type BucketStatus, type CutIdea, type Transaction } from '@/src/domain';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  /** Structured answer shown as a card (assistant turns). */
  answer?: AskAnswer;
  /** True when answered on the phone from sample data rather than by Claude. */
  preview?: boolean;
}

export type CreditsLeft = { monthly: number; extra: number; total: number };

/** Thrown when the household has no AI credits left this month. */
export class OutOfCreditsError extends Error {
  constructor(public credits?: CreditsLeft) { super('out_of_credits'); }
}

/** Set EXPO_PUBLIC_SUPABASE_URL to send questions to the `ask` backend function. */
const API = process.env.EXPO_PUBLIC_SUPABASE_URL;

export const SUGGESTED_QUESTIONS = [
  'How can I cut my spending this month?',
  'Am I on track this month?',
  'Where is most of my money going?',
  'Which subscriptions am I paying for?',
];

export async function ask(
  question: string,
  history: ChatTurn[],
  ctx: { householdId?: string; accessToken?: string } & PreviewContext,
): Promise<ChatTurn & { credits?: CreditsLeft }> {
  if (API && ctx.householdId && ctx.accessToken) {
    const res = await fetch(`${API}/functions/v1/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.accessToken}` },
      body: JSON.stringify({ householdId: ctx.householdId, question, history: history.map(({ role, text }) => ({ role, text })) }),
    });
    const data = await res.json();
    if (res.status === 402) throw new OutOfCreditsError(data.credits);
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
    const answer = data.answer as AskAnswer;
    return { role: 'assistant', text: answerToText(answer), answer, credits: data.credits };
  }
  const answer = previewAnswer(question, ctx);
  return { role: 'assistant', text: answerToText(answer), answer, preview: true };
}

type PreviewContext = { statuses: BucketStatus[]; cutIdeas: CutIdea[]; transactions: Transaction[]; month: string; today: number };

/**
 * Until the backend is connected, answer common questions on the phone with the same
 * budget logic the AI uses as its facts, in the same card format.
 */
function previewAnswer(q: string, ctx: PreviewContext): AskAnswer {
  const text = q.toLowerCase();
  const short = (c: number) => formatCents(c, { showCents: false });
  const days = daysInMonth(ctx.month);
  const nameOf = (id?: string) => ctx.statuses.find((s) => s.bucket.id === id)?.bucket.name ?? null;

  if (/cut|save|saving|reduce|less|spend less|lower/.test(text)) {
    if (!ctx.cutIdeas.length) return { headline: "You're on track everywhere, so there's nothing urgent to cut.", rows: [] };
    const top = ctx.cutIdeas.slice(0, 4);
    const total = top.slice(0, 3).reduce((s, i) => s + i.saving, 0);
    return {
      headline: `You could save about ${short(total)} this month.`,
      rowsTitle: 'Biggest opportunities',
      rows: top.map((i) => ({ label: i.label, value: `Save ~${short(i.saving)}`, detail: i.note,
        tone: i.title.startsWith('Slow') ? 'warn' : 'neutral', bucket: i.title.startsWith('Slow') ? nameOf(i.bucketId) : null })),
      tip: `Start with ${top[0].label}. It's the biggest saving.`,
    };
  }
  if (/subscription|recurring/.test(text)) {
    const subs = findSubscriptions(ctx.transactions);
    if (!subs.length) return { headline: "I haven't spotted any subscriptions yet.", rows: [], tip: 'They show up after two months of charges.' };
    const total = subs.reduce((s, x) => s + x.amount, 0);
    return {
      headline: `You pay ${formatCents(total)} a month for ${subs.length} subscriptions.`,
      rows: subs.map((x) => ({ label: x.vendor, value: `${formatCents(x.amount)}/mo`,
        detail: x.amount > x.previousAmount ? `Up from ${formatCents(x.previousAmount)}` : null,
        tone: x.amount > x.previousAmount ? 'warn' : 'neutral' })),
      tip: 'Settings → Subscriptions can cancel one for you.',
    };
  }
  if (/store|shop|location|place|visit|vendor|merchant|restaurant|went|go to|eat at/.test(text)) {
    const byVisits = !/spend|spent|money|cost|dollar|\$/.test(text) || /visit|often|times|went|go to/.test(text);
    // This month and last, so there's enough history to show a pattern.
    const months = [previousMonth(ctx.month), ctx.month];
    const stores = topStores(ctx.transactions, { months, by: byVisits ? 'visits' : 'spend', limit: 5 });
    if (!stores.length) return { headline: 'No purchases yet.', rows: [] };
    const top = stores[0];
    const tied = byVisits && stores[1]?.visits === top.visits;
    return {
      headline: tied
        ? `${top.store} and ${stores[1].store} are tied for most visited, ${top.visits} times each.`
        : byVisits
          ? `You go to ${top.store} the most: ${top.visits} visit${top.visits > 1 ? 's' : ''} in the last two months.`
          : `You spend the most at ${top.store}: ${short(top.total)} in the last two months.`,
      rowsTitle: byVisits ? 'Most visited, last two months' : 'Top stores by spending, last two months',
      rows: stores.map((x) => ({ label: x.store, value: byVisits ? `${x.visits} visit${x.visits > 1 ? 's' : ''}` : short(x.total),
        detail: byVisits ? `${short(x.total)} total · last ${shortDate(x.lastDate)}` : `${x.visits} visit${x.visits > 1 ? 's' : ''} · last ${shortDate(x.lastDate)}`, tone: 'neutral' })),
      tip: 'Activity → All vendors shows every purchase at a store.',
    };
  }
  if (/where|most|biggest|top/.test(text)) {
    const top = [...ctx.statuses].sort((a, b) => b.spent - a.spent).filter((s) => s.spent > 0).slice(0, 5);
    const total = ctx.statuses.reduce((s, b) => s + b.spent, 0);
    return {
      headline: `You've spent ${short(total)} so far, mostly on ${top[0]?.bucket.name ?? 'nothing yet'}.`,
      rowsTitle: 'Top buckets this month',
      rows: top.map((s) => ({ label: s.bucket.name, value: short(s.spent),
        detail: `${Math.round((s.spent / Math.max(1, total)) * 100)}% of spending`, tone: 'neutral', bucket: s.bucket.name })),
    };
  }
  if (/track|pace|doing|budget|status/.test(text)) {
    const paces = ctx.statuses.map((s) => ({ s, p: bucketPace(s, ctx.today, days) }));
    const off = paces.filter(({ p }) => p.status === 'over');
    const spent = ctx.statuses.reduce((s, b) => s + b.spent, 0);
    const limit = ctx.statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
    return {
      headline: off.length
        ? `Mostly yes: ${short(spent)} of ${short(limit)} used, but ${off.length} bucket${off.length > 1 ? 's need' : ' needs'} attention.`
        : `Yes. ${short(spent)} of ${short(limit)} used and every bucket is on track.`,
      rowsTitle: off.length ? 'Needs attention' : null,
      rows: off.map(({ s, p }) => ({ label: s.bucket.name, value: `${short(s.spent)} of ${short(s.bucket.monthlyLimit)}`,
        detail: s.overBy > 0 ? `Over by ${short(s.overBy)}` : `Heading for ${short(p.projectedTotal)}`,
        tone: s.overBy > 0 ? 'bad' : 'warn', bucket: s.bucket.name })),
      tip: `${days - ctx.today} days left this month.`,
    };
  }
  return { headline: 'In this preview I can answer a few common questions.', rows: [], tip: 'Try one of the suggested questions. Any question works once your accounts are connected.' };
}
