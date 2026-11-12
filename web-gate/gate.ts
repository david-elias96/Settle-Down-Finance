/**
 * Early-access password gate for the web app (app.settledownfinancial.com), run by the Cloudflare
 * Pages middleware in functions/_middleware.ts before any page or app file is served.
 *
 * The password is never in the repo or the app bundle: it lives only in the Pages secret
 * SITE_PASSWORD. After the right password, the browser gets an HttpOnly cookie holding an expiry
 * and an HMAC of it keyed by the password, so changing the secret signs everyone out.
 * With no secret set, the gate fails closed.
 */

export const COOKIE = 'sd_gate';
export const GATE_PATH = '/__gate';
const DAYS = 90;

/** Files the browser fetches without our cookie (manifest, home-screen icons), safe to serve to anyone. */
const OPEN = [/^\/manifest\.webmanifest$/, /^\/icons\//, /^\/splash\//, /^\/favicon\.ico$/, /^\/robots\.txt$/];

export function isOpenPath(path: string): boolean {
  return OPEN.some((re) => re.test(path));
}

/** Only same-site paths, so the gate can't be used to bounce people to another site. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith(GATE_PATH)) return '/';
  return next;
}

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two equal-purpose strings. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compares a typed password to the secret without leaking timing (both are hashed first). */
export async function passwordMatches(typed: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac('sd-gate-compare', typed), hmac('sd-gate-compare', secret)]);
  return sameText(a, b);
}

export async function makeToken(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + DAYS * 864e5);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function tokenValid(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return sameText(sig, await hmac(secret, exp));
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function cookieHeader(token: string): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const GATE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/** The password page, in the app's Grove colors, light and dark. */
export function gatePage(next: string, error?: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F6F4EE"><meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<title>Settle Down</title>
<style>
:root{--bg:#F6F4EE;--card:#fff;--text:#1B2420;--muted:#5E6A64;--green:#1F5C45;--onGreen:#fff;--line:#E3E0D7;--bad:#B3261E}
@media (prefers-color-scheme:dark){:root{--bg:#0D1712;--card:#18221E;--text:#EEF2EF;--muted:#9AA8A1;--green:#8FD1AE;--onGreen:#0E2A1E;--line:#2A3631;--bad:#F2A097}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.card{width:100%;max-width:380px;text-align:center}
img{width:72px;height:72px;border-radius:18px}
h1{font-family:Georgia,"Times New Roman",serif;font-size:28px;margin:16px 0 6px}
p{color:var(--muted);margin:0 0 22px}
input{width:100%;font-size:17px;padding:14px 18px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--text);outline:none}
input:focus{border-color:var(--green)}
button{width:100%;margin-top:12px;font-size:17px;font-weight:600;padding:14px;border:0;border-radius:999px;background:var(--green);color:var(--onGreen);cursor:pointer}
.err{color:var(--bad);font-size:14px;margin:10px 0 0}
</style></head><body><main><form class="card" method="post" action="${GATE_PATH}">
<img src="/icons/icon-192.png" alt="">
<h1>Settle Down</h1>
<p>We're in early access. Enter the password to continue.</p>
<input type="hidden" name="next" value="${esc(next)}">
<input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required aria-label="Password">
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<button type="submit">Continue</button>
</form></main></body></html>`;
}
