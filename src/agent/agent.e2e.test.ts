/**
 * Runs the real page scripts and the safety checks in a headless browser against the
 * practice site, with the demo agent choosing steps. Needs Playwright:
 *   E2E=1 npx vitest run src/agent
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { checkAction, type AgentAction, type PageSnapshot } from '../domain';
import { demoAgentStep } from './demoAgent';
import { actionJs, SNAPSHOT_JS } from './pageScripts';
import { PRACTICE_SITE_HTML } from './practiceSite';

const run = process.env.E2E ? describe : describe.skip;

run('cancel agent on the practice site', () => {
  it('cancels end to end, hands over login, refuses sensitive typing, and confirms the final click', async () => {
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('dialog', (d: { dismiss: () => void }) => d.dismiss());
    await page.setContent(PRACTICE_SITE_HTML);
    const domains = ['practice.settledownfinance.com'];
    const snap = async (): Promise<PageSnapshot> => ({ ...JSON.parse(await page.evaluate(SNAPSHOT_JS)), url: 'https://practice.settledownfinance.com/' });

    // Snapshot of the login page: password is marked sensitive and nothing typed is read.
    await page.fill('#email', 'someone@example.com');
    let s = await snap();
    expect(s.hasPasswordField).toBe(true);
    expect(s.elements.find((e) => e.text === 'Password')?.sensitive).toBe(true);
    expect(JSON.stringify(s)).not.toContain('someone@example.com');
    // The agent may not type the password itself.
    const pw = s.elements.find((e) => e.text === 'Password')!;
    expect(checkAction({ kind: 'type', elementId: pw.id, text: 'hunter2', why: '' }, s, domains)).toMatch(/Only the user/);
    expect(checkAction({ kind: 'go_to', url: 'https://evil.example/', why: '' }, s, domains)).toMatch(/outside/);

    const history: AgentAction[] = [];
    let finalConfirmed = false;
    for (let i = 0; i < 15; i++) {
      s = await snap();
      const a = demoAgentStep(s, history);
      history.push(a);
      expect(checkAction(a, s, domains)).toBeNull();
      if (a.kind === 'finish') break;
      if (a.kind === 'hand_to_user') {
        // The user signs in themselves.
        await page.fill('#pw', 'their-own-password');
        await page.click('button:has-text("Sign in")');
        continue;
      }
      if (a.kind === 'click' && a.finalCancel) finalConfirmed = true; // the app asks the user here
      if (a.kind === 'click' || a.kind === 'choose' || a.kind === 'type' || a.kind === 'scroll') {
        expect(await page.evaluate(actionJs(a))).toBe('ok');
      }
    }
    const done = history.at(-1)!;
    expect(history.map((h) => h.kind === 'click' ? (h as { why: string }).why : h.kind)).toEqual([
      'hand_to_user', 'Opening membership settings', 'Opening the cancel option', 'Skipping the discount offer',
      'choose', 'Continuing past the survey', 'Finishing the cancellation', 'finish',
    ]);
    expect(finalConfirmed).toBe(true);
    expect(done).toMatchObject({ kind: 'finish', outcome: 'cancelled', confirmation: 'SC-48213', endsOn: 'Dec 8' });
    // The page text sent to the agent never contained the password.
    expect(JSON.stringify(await snap())).not.toContain('their-own-password');
    await browser.close();
  }, 60000);
});
