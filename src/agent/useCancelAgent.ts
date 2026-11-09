import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { AgentBrowserHandle } from '@/components/AgentBrowser';
import { checkAction, type AgentAction, type CancelOutcome, type PageSnapshot } from '@/src/domain';
import { nextAction, stopCancel } from './client';
import { demoAgentStep } from './demoAgent';
import { actionJs, SNAPSHOT_JS } from './pageScripts';

export type AgentPhase =
  | { name: 'working'; status: string }
  | { name: 'your_turn'; message: string }
  | { name: 'confirm'; status: string; button: string }
  | { name: 'done'; outcome: CancelOutcome; summary: string; confirmation: string | null; endsOn: string | null }
  | { name: 'error'; message: string };

type Click = Extract<AgentAction, { kind: 'click' }>;

interface Options {
  browser: RefObject<AgentBrowserHandle | null>;
  allowedDomains: string[];
  /** Practice run: the built-in rules stand in for Claude. Otherwise the backend session. */
  demo: boolean;
  session?: { id: string; accessToken: string };
}

const MAX_STEPS = 45;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the cancel loop on the phone: read the page, ask the agent for one action, check
 * it against the safety rules, carry it out, repeat. Pauses for the user to sign in and
 * to approve the final cancel click.
 */
export function useCancelAgent({ browser, allowedDomains, demo, session }: Options) {
  const [phase, setPhase] = useState<AgentPhase>({ name: 'working', status: 'Opening the website' });
  const history = useRef<AgentAction[]>([]);
  const stopped = useRef(false);
  const steps = useRef(0);
  const pageLoaded = useRef<(() => void) | null>(null);
  const resume = useRef<((answer: { ok: boolean; note?: string }) => void) | null>(null);

  /** Called by the browser on every page load. */
  const onPageLoaded = useCallback(() => { pageLoaded.current?.(); }, []);

  /** Waits for a navigation to finish, or a moment for in-page changes. */
  const settle = (ms = 1200) => new Promise<void>((resolve) => {
    const t = setTimeout(() => { pageLoaded.current = null; resolve(); }, ms);
    pageLoaded.current = () => { clearTimeout(t); pageLoaded.current = null; setTimeout(resolve, 400); };
  });

  const snapshot = async (): Promise<PageSnapshot> => JSON.parse(await browser.current!.evaluate(SNAPSHOT_JS));

  const waitForUser = () => new Promise<{ ok: boolean; note?: string }>((r) => { resume.current = r; });

  const decide = async (page: PageSnapshot, ok: boolean, note?: string): Promise<AgentAction> => {
    if (demo) {
      await sleep(700); // pace the practice run so it can be followed
      return demoAgentStep(page, history.current);
    }
    return nextAction(session!.accessToken, session!.id, { ok, note, snapshot: page });
  };

  const run = useCallback(async () => {
    let ok = true;
    let note: string | undefined;
    await settle(2500);
    while (!stopped.current) {
      if (++steps.current > MAX_STEPS) {
        setPhase({ name: 'done', outcome: 'failed', summary: 'This took too many steps, so I stopped.', confirmation: null, endsOn: null });
        return;
      }
      const page = await snapshot();
      const action = await decide(page, ok, note);
      if (stopped.current) return;
      history.current.push(action);
      ok = true; note = undefined;

      if (action.kind === 'finish') {
        setPhase({ name: 'done', outcome: action.outcome, summary: action.summary, confirmation: action.confirmation, endsOn: action.endsOn });
        return;
      }
      if (action.kind === 'hand_to_user') {
        setPhase({ name: 'your_turn', message: action.message });
        const answer = await waitForUser();
        ({ ok, note } = answer);
        setPhase({ name: 'working', status: 'Picking up from here' });
        await settle(800);
        continue;
      }

      const refusal = checkAction(action, page, allowedDomains);
      if (refusal) { ok = false; note = refusal; continue; }

      if (action.kind === 'click' && action.finalCancel) {
        setPhase({ name: 'confirm', status: action.why, button: page.elements.find((e) => e.id === action.elementId)?.text ?? 'confirm' });
        const answer = await waitForUser();
        if (!answer.ok) {
          if (demo) {
            setPhase({ name: 'done', outcome: 'failed', summary: 'You chose to keep the subscription. Nothing was cancelled.', confirmation: null, endsOn: null });
            return;
          }
          ok = false; note = 'The user chose not to cancel.';
          continue;
        }
      }

      setPhase({ name: 'working', status: 'why' in action ? action.why : 'Working' });
      if (action.kind === 'go_to') browser.current!.goTo(action.url);
      else if (action.kind === 'go_back') browser.current!.goBack();
      else {
        const res = await browser.current!.evaluate(actionJs(action as Click));
        if (res !== 'ok') { ok = false; note = res; }
      }
      await settle();
    }
  }, [demo, session?.id]);

  useEffect(() => {
    stopped.current = false;
    run().catch((e) => setPhase({ name: 'error', message: (e as Error).message }));
    return () => { stopped.current = true; resume.current?.({ ok: false, note: 'Closed' }); };
  }, [run]);

  return {
    phase,
    onPageLoaded,
    /** The user finished their part (signing in) and hands control back. */
    userDone: () => resume.current?.({ ok: true, note: 'The user says they finished. Check the page.' }),
    /** Answer to the final-cancel confirmation. */
    confirm: (yes: boolean) => resume.current?.({ ok: yes }),
    stop: async () => {
      stopped.current = true;
      resume.current?.({ ok: false });
      if (session && !demo) await stopCancel(session.accessToken, session.id).catch(() => {});
    },
  };
}
