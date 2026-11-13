// Stripe, called over its REST API (no SDK, so nothing extra to audit or bundle).
// The secret key lives only in the edge-function secret STRIPE_SECRET_KEY; use a restricted key
// with write access to Customers, Checkout Sessions, Customer portal and Subscriptions only.
// Card details never reach us: people pay on Stripe's hosted pages (PCI scope SAQ A).

const API = 'https://api.stripe.com/v1';

/** Flattens `{ a: { b: 1 }, c: [x] }` to Stripe's form encoding: a[b]=1&c[0]=x. */
export function formEncode(body: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? formEncode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') formEncode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? formEncode(body) : undefined });
  const data = await res.json().catch(() => ({}));
  // Log only Stripe's error type and code, never the request or response bodies.
  if (!res.ok) throw new Error(`Stripe ${path.split('/')[1]} failed: ${res.status} ${data?.error?.type ?? ''} ${data?.error?.code ?? ''}`.trim());
  return data as T;
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks the Stripe-Signature header: an HMAC-SHA256 of `${timestamp}.${raw body}` keyed by the
 * endpoint's signing secret, within five minutes. Fails closed when the secret is missing.
 */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string | undefined, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  return sigs.some((s) => sameText(s, expected));
}

/** Price ids for the two plans, from the edge-function secrets. */
export function priceFor(plan: 'monthly' | 'yearly'): string {
  const id = Deno.env.get(plan === 'yearly' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY');
  if (!id) throw new Error(`Stripe price for ${plan} is not set`);
  return id;
}

export function planForPrice(priceId: string | undefined): 'monthly' | 'yearly' | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('STRIPE_PRICE_YEARLY')) return 'yearly';
  if (priceId === Deno.env.get('STRIPE_PRICE_MONTHLY')) return 'monthly';
  return null;
}
