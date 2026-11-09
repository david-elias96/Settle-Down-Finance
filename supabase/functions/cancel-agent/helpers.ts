import type Anthropic from '@anthropic-ai/sdk';
import type { AgentAction, PageSnapshot } from '../_shared/domain/index.ts';

/** Older page snapshots are shortened so the conversation stays small. */
const FULL_SNAPSHOTS_KEPT = 2;

export function describePage(p: PageSnapshot): string {
  const els = p.elements.map((e) => {
    const flags = [e.sensitive && 'user-only field', e.disabled && 'disabled', e.checked !== undefined && (e.checked ? 'checked' : 'unchecked')]
      .filter(Boolean).join(', ');
    const href = e.href ? ` -> ${safePath(e.href)}` : '';
    const opts = e.options ? ` options: ${e.options.join(' | ')}` : '';
    return `[${e.id}] ${e.role ?? e.tag}${e.type ? `(${e.type})` : ''} "${e.text}"${flags ? ` (${flags})` : ''}${href}${opts}`;
  });
  return `URL: ${safePath(p.url)}\nTitle: ${p.title}\n\nPage text:\n${p.text.slice(0, 4000)}\n\nElements:\n${els.join('\n') || '(none)'}`;
}

/** Drops query strings and fragments, which can carry tokens. */
export function safePath(url: string) {
  try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return url.slice(0, 200); }
}

export function toAction(block: Anthropic.Beta.BetaToolUseBlock): AgentAction {
  const i = block.input as Record<string, any>;
  switch (block.name) {
    case 'click': return { kind: 'click', elementId: String(i.element), why: i.why, finalCancel: !!i.final_cancel };
    case 'type_text': return { kind: 'type', elementId: String(i.element), text: String(i.text), why: i.why };
    case 'choose_option': return { kind: 'choose', elementId: String(i.element), option: String(i.option), why: i.why };
    case 'scroll': return { kind: 'scroll', direction: i.direction === 'up' ? 'up' : 'down', why: i.why };
    case 'go_to': return { kind: 'go_to', url: String(i.url), why: i.why };
    case 'go_back': return { kind: 'go_back', why: i.why };
    case 'hand_to_user': return { kind: 'hand_to_user', reason: i.reason, message: i.message };
    default: return { kind: 'finish', outcome: i.outcome ?? 'failed', summary: i.summary ?? 'Stopped.', confirmation: i.confirmation ?? null, endsOn: i.ends_on ?? null };
  }
}

/** Replaces all but the latest page snapshots with a short placeholder. */
export function trimmed(messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  let kept = 0;
  return [...messages].reverse().map((m) => {
    if (m.role !== 'user' || !Array.isArray(m.content)) return m;
    return { ...m, content: m.content.map((b) => {
      if (b.type !== 'tool_result' && b.type !== 'text') return b;
      const text = b.type === 'text' ? b.text : String(b.content ?? '');
      if (!text.includes('Elements:')) return b;
      if (kept++ < FULL_SNAPSHOTS_KEPT) return b;
      const short = text.replace(/\n\nPage text:[\s\S]*$/, '\n(older page, details omitted)');
      return b.type === 'text' ? { ...b, text: short } : { ...b, content: short };
    }) };
  }).reverse();
}

