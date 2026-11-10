// Cloudflare Pages Function: POST /api/waitlist
// Stores waitlist sign-ups in the KV namespace bound as WAITLIST.
// Setup: Cloudflare dashboard > Workers & Pages > settledownfinance > Settings >
// Bindings > add a KV namespace binding named WAITLIST.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  if (!env.WAITLIST) return json({ error: 'not_configured' }, 503);

  let email = '';
  try {
    const body = await request.json();
    email = String(body.email || '').trim().toLowerCase();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);

  const key = `email:${email}`;
  if (!(await env.WAITLIST.get(key))) {
    await env.WAITLIST.put(key, JSON.stringify({ email, joinedAt: new Date().toISOString() }));
  }
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'method_not_allowed' }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
