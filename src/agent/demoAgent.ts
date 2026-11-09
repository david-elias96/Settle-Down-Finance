import type { AgentAction, PageSnapshot } from '../domain';

/**
 * Stand-in for Claude in the practice demo, so the flow works in Expo Go before the
 * backend is connected. Follows simple rules; the real agent reasons about each page.
 */
export function demoAgentStep(page: PageSnapshot, history: AgentAction[]): AgentAction {
  const loggedInHandoffDone = history.some((h) => h.kind === 'hand_to_user');
  const last = history.at(-1);
  const text = page.text.toLowerCase();
  const find = (re: RegExp, not?: RegExp) =>
    page.elements.find((e) => !e.disabled && re.test(e.text) && !(not && not.test(e.text)));

  if (/membership cancelled|has been cancelled|is cancelled/.test(text)) {
    const conf = page.text.match(/confirmation\s+([A-Z0-9-]+)/i)?.[1] ?? null;
    const ends = page.text.match(/until ([A-Z][a-z]{2} \d{1,2})/)?.[1] ?? null;
    return { kind: 'finish', outcome: 'cancelled', summary: 'Your membership is cancelled and you won\'t be charged again.', confirmation: conf, endsOn: ends };
  }
  if (page.hasPasswordField) {
    return loggedInHandoffDone
      ? { kind: 'finish', outcome: 'failed', summary: 'Still on the sign-in page after handing over.', confirmation: null, endsOn: null }
      : { kind: 'hand_to_user', reason: 'login', message: 'Sign in to StreamCo below.' };
  }
  const finalBtn = find(/finish cancel|confirm cancel|yes, cancel/i);
  if (finalBtn) return { kind: 'click', elementId: finalBtn.id, why: 'Finishing the cancellation', finalCancel: true };
  const select = page.elements.find((e) => e.tag === 'select' && e.options?.some((o) => /expensive/i.test(o)));
  if (select) {
    const cont = find(/^continue$/i);
    if (cont && last?.kind === 'choose') return { kind: 'click', elementId: cont.id, why: 'Continuing past the survey', finalCancel: false };
    return { kind: 'choose', elementId: select.id, option: 'Too expensive', why: 'Answering the exit survey' };
  }
  const decline = find(/no thanks|continue to cancel|decline/i);
  if (decline) return { kind: 'click', elementId: decline.id, why: 'Skipping the discount offer', finalCancel: false };
  const cancel = find(/cancel (membership|subscription|plan)/i);
  if (cancel) return { kind: 'click', elementId: cancel.id, why: 'Opening the cancel option', finalCancel: false };
  const manage = find(/manage (membership|subscription|plan)/i);
  if (manage) return { kind: 'click', elementId: manage.id, why: 'Opening membership settings', finalCancel: false };
  return { kind: 'finish', outcome: 'not_found', summary: 'Couldn\'t find a way to cancel on this page.', confirmation: null, endsOn: null };
}
