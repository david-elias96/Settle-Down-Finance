import { assertEquals } from 'jsr:@std/assert@1';
import { formEncode, verifyStripeSignature } from './stripe.ts';

async function sign(secret: string, t: number, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

const SECRET = 'whsec_test_only';
const BODY = '{"type":"customer.subscription.updated"}';
const NOW = 1_800_000_000;

Deno.test('accepts a correctly signed, fresh event', async () => {
  const header = `t=${NOW},v1=${await sign(SECRET, NOW, BODY)}`;
  assertEquals(await verifyStripeSignature(BODY, header, SECRET, NOW), true);
});

Deno.test('accepts when any v1 signature matches (secret rotation)', async () => {
  const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${await sign(SECRET, NOW, BODY)}`;
  assertEquals(await verifyStripeSignature(BODY, header, SECRET, NOW), true);
});

Deno.test('rejects a changed body, wrong secret, old timestamp, missing parts', async () => {
  const good = `t=${NOW},v1=${await sign(SECRET, NOW, BODY)}`;
  assertEquals(await verifyStripeSignature(BODY + ' ', good, SECRET, NOW), false);
  assertEquals(await verifyStripeSignature(BODY, good, 'whsec_other', NOW), false);
  assertEquals(await verifyStripeSignature(BODY, good, SECRET, NOW + 301), false);
  assertEquals(await verifyStripeSignature(BODY, `v1=${await sign(SECRET, NOW, BODY)}`, SECRET, NOW), false);
  assertEquals(await verifyStripeSignature(BODY, `t=${NOW}`, SECRET, NOW), false);
  assertEquals(await verifyStripeSignature(BODY, null, SECRET, NOW), false);
});

Deno.test('fails closed without a signing secret', async () => {
  const header = `t=${NOW},v1=${await sign('', NOW, BODY)}`;
  assertEquals(await verifyStripeSignature(BODY, header, undefined, NOW), false);
  assertEquals(await verifyStripeSignature(BODY, header, '', NOW), false);
});

Deno.test('form-encodes nested objects and arrays the way Stripe expects', () => {
  const f = formEncode({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], subscription_data: { metadata: { user_id: 'u' } }, skip: undefined });
  assertEquals(f.toString(), 'mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&subscription_data%5Bmetadata%5D%5Buser_id%5D=u');
});
