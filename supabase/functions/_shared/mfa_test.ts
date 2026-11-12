import { assertEquals } from 'jsr:@std/assert@1';
import { needsSecondFactor } from './mfa.ts';

const token = (claims: Record<string, unknown>) =>
  `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;

Deno.test('no second factor set up: any session is fine', () => {
  assertEquals(needsSecondFactor([], token({ aal: 'aal1' })), false);
  assertEquals(needsSecondFactor([{ status: 'unverified' }], token({ aal: 'aal1' })), false);
});

Deno.test('second factor set up: an aal1 session is refused', () => {
  assertEquals(needsSecondFactor([{ status: 'verified' }], token({ aal: 'aal1' })), true);
  assertEquals(needsSecondFactor([{ status: 'verified' }], 'not-a-jwt'), true);
});

Deno.test('second factor set up and used: allowed', () => {
  assertEquals(needsSecondFactor([{ status: 'verified' }], token({ aal: 'aal2' })), false);
});
