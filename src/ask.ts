import { bucketPace, daysInMonth, formatCents, type BucketStatus, type CutIdea } from '@/src/domain';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
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
  ctx: { householdId?: string; accessToken?: string; statuses: BucketStatus[]; cutIdeas: CutIdea[]; month: string; today: number },
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
    return { role: 'assistant', text: data.answer, credits: data.credits };
  }
  return { role: 'assistant', text: previewAnswer(question, ctx), preview: true };
}

/**
 * Until the backend is connected, answer common questions on the phone with the same
 * budget logic the AI uses as its facts.
 */
function previewAnswer(q: string, ctx: { statuses: BucketStatus[]; cutIdeas: CutIdea[]; month: string; today: number }) {
  const text = q.toLowerCase();
  const short = (c: number) => formatCents(c, { showCents: false });
  const days = daysInMonth(ctx.month);

  if (/cut|save|saving|reduce|less|spend less|lower/.test(text)) {
    if (!ctx.cutIdeas.length) return "You're on track everywhere this month, so there's nothing urgent to cut.";
    const total = ctx.cutIdeas.slice(0, 3).reduce((s, i) => s + i.saving, 0);
    return [`Here are the biggest opportunities, worth up to about ${short(total)} this month:`,
      ...ctx.cutIdeas.slice(0, 4).map((i) => `• ${i.title}: ${i.detail}`)].join('\n');
  }
  if (/subscription|recurring/.test(text)) {
    const subs = ctx.cutIdeas.find((i) => i.title.startsWith('Review'));
    return subs ? `${subs.title}.\n${subs.detail}` : "I haven't spotted recurring subscriptions yet. They show up after two months of charges.";
  }
  if (/where|most|biggest|top/.test(text)) {
    const top = [...ctx.statuses].sort((a, b) => b.spent - a.spent).filter((s) => s.spent > 0).slice(0, 4);
    const total = ctx.statuses.reduce((s, b) => s + b.spent, 0);
    return [`You've spent ${short(total)} so far this month. The biggest buckets:`,
      ...top.map((s) => `• ${s.bucket.name}: ${short(s.spent)} (${Math.round((s.spent / Math.max(1, total)) * 100)}%)`)].join('\n');
  }
  if (/track|pace|doing|budget|status/.test(text)) {
    const paces = ctx.statuses.map((s) => ({ s, p: bucketPace(s, ctx.today, days) }));
    const off = paces.filter(({ p }) => p.status === 'over');
    const spent = ctx.statuses.reduce((s, b) => s + b.spent, 0);
    const limit = ctx.statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
    return [`You've used ${short(spent)} of ${short(limit)} with ${days - ctx.today} days left.`,
      off.length ? 'Needs attention:' : 'Every bucket is on track or under pace. Nice work!',
      ...off.map(({ s, p }) => `• ${s.bucket.name}: ${p.label}. ${p.detail}.`)].join('\n');
  }
  return 'In this preview I can answer questions about cutting spending, being on track, where money is going, and subscriptions. Full answers to any question turn on when the app is connected to your accounts.';
}
