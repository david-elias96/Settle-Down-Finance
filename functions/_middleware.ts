/**
 * Cloudflare Pages middleware: puts the early-access password gate (web-gate/gate.ts) in front of
 * every request to the web app. The password is the Pages secret SITE_PASSWORD, never in the repo.
 */
import { COOKIE, GATE_HEADERS, GATE_PATH, cookieHeader, gatePage, isOpenPath, makeToken, passwordMatches, readCookie, safeNext, tokenValid } from '../web-gate/gate';

type Context = { request: Request; env: { SITE_PASSWORD?: string; EARLY_ACCESS?: string }; next: () => Promise<Response> };

const html = (body: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...GATE_HEADERS, ...extra } });

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const url = new URL(request.url);
  const secret = env.SITE_PASSWORD;

  if (isOpenPath(url.pathname)) return next();
  // Launch switch: set the Pages variable EARLY_ACCESS=off once paid plans are live (the app's own
  // sign-in and plan picker take over). Anything else, including unset, keeps the password gate.
  if (env.EARLY_ACCESS === 'off') return next();
  // Fail closed: without the secret nobody gets in.
  if (!secret) return html(gatePage('/', 'The app is closed right now. Please try again later.'), 503);

  if (url.pathname === GATE_PATH) {
    if (request.method === 'POST') {
      // The form posts application/x-www-form-urlencoded; cap the body so nobody can send megabytes.
      const form = new URLSearchParams((await request.text().catch(() => '')).slice(0, 4096));
      const typed = String(form.get('password') ?? '');
      const target = safeNext(String(form.get('next') ?? '/'));
      if (typed && (await passwordMatches(typed, secret))) {
        return new Response(null, { status: 303, headers: { Location: target, 'Set-Cookie': cookieHeader(await makeToken(secret)), 'Cache-Control': 'no-store' } });
      }
      // Slow down guessing a little.
      await new Promise((r) => setTimeout(r, 800));
      return html(gatePage(target, "That password didn't work."), 401);
    }
    return html(gatePage(safeNext(url.searchParams.get('next'))));
  }

  if (await tokenValid(readCookie(request.headers.get('Cookie'), COOKIE), secret)) return next();

  // Page loads get the password page; anything else (scripts, the service worker, data) gets a bare 401.
  const accept = request.headers.get('Accept') ?? '';
  if (request.method === 'GET' && accept.includes('text/html')) {
    return html(gatePage(safeNext(url.pathname + url.search)), 401);
  }
  return new Response('Password required', { status: 401, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
