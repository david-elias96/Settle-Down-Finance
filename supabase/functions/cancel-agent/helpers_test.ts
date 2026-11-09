import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { describePage, safePath, toAction, trimmed } from './helpers.ts';

const page = {
  url: 'https://www.netflix.com/account?token=SECRET#x', title: 'Account', text: 'Membership', hasPasswordField: false,
  elements: [
    { id: '1', tag: 'button', text: 'Cancel membership' },
    { id: '2', tag: 'input', type: 'password', text: 'Password', sensitive: true },
    { id: '3', tag: 'select', text: 'Reason', options: ['Too expensive', 'Other'] },
  ],
};

Deno.test('describes the page without query strings and marks user-only fields', () => {
  const d = describePage(page);
  assertStringIncludes(d, 'URL: https://www.netflix.com/account\n');
  assertEquals(d.includes('SECRET'), false);
  assertStringIncludes(d, '[1] button "Cancel membership"');
  assertStringIncludes(d, '[2] input(password) "Password" (user-only field)');
  assertStringIncludes(d, 'options: Too expensive | Other');
  assertEquals(safePath('not a url'), 'not a url');
});

Deno.test('maps tool calls to actions', () => {
  assertEquals(toAction({ type: 'tool_use', id: 't', name: 'click', input: { element: 1, why: 'Open', final_cancel: true } } as any),
    { kind: 'click', elementId: '1', why: 'Open', finalCancel: true });
  assertEquals(toAction({ type: 'tool_use', id: 't', name: 'finish', input: { outcome: 'cancelled', summary: 'Done', confirmation: null, ends_on: 'Dec 8' } } as any),
    { kind: 'finish', outcome: 'cancelled', summary: 'Done', confirmation: null, endsOn: 'Dec 8' });
});

Deno.test('keeps only the latest two full page snapshots', () => {
  const snap = (n: number) => `Done.\n\nURL: u${n}\nTitle: t\n\nPage text:\nbody ${n}\n\nElements:\n[1] button "x"`;
  const msgs = [1, 2, 3].flatMap((n) => [
    { role: 'user' as const, content: [{ type: 'tool_result' as const, tool_use_id: `t${n}`, content: snap(n) }] },
    { role: 'assistant' as const, content: [{ type: 'tool_use' as const, id: `t${n + 1}`, name: 'scroll', input: {} }] },
  ]);
  const out = trimmed(msgs as any).filter((m) => m.role === 'user').map((m) => (m.content as any)[0].content as string);
  assertStringIncludes(out[0], '(older page, details omitted)');
  assertStringIncludes(out[1], 'body 2');
  assertStringIncludes(out[2], 'body 3');
});
