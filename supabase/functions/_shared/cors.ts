// CORS for the installable web app (app.settledownfinancial.com). The iOS app doesn't need it.
// Only origins on the allowlist get CORS headers; any other site's browser calls are blocked by
// the browser, and every function still checks the caller's session itself.

const DEFAULT_ORIGINS = ['https://app.settledownfinancial.com'];

/** Allowed web origins: APP_WEB_ORIGINS (comma-separated, exact https origins) or the default. */
export function allowedOrigins(env: string | undefined): string[] {
  const list = (env ?? '').split(',').map((s) => s.trim()).filter((s) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(s));
  return list.length ? list : DEFAULT_ORIGINS;
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-region',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
