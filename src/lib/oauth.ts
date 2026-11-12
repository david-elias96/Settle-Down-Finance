/** Query and fragment parameters of a sign-in redirect URL, e.g. settledown://auth-callback?code=… */
export function oauthParams(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const query = url.split('#')[0].split('?')[1] ?? '';
  const fragment = url.split('#')[1] ?? '';
  for (const part of [query, fragment]) new URLSearchParams(part).forEach((v, k) => out.set(k, v));
  return out;
}

/** Our website's sign-in hand-off page. Supabase always accepts it (it's the Site URL's domain). */
export const AUTH_HANDOFF_URL = 'https://settledownfinancial.com/auth-callback/';

/**
 * Where Supabase sends the browser after Google sign-in: our website, which forwards the code
 * to `appReturn` (the app's own auth-callback address). Supabase turned away the app's exp://
 * address in Expo Go even when listed, and fell back to the plain website.
 */
export function handoffRedirect(appReturn: string): string {
  return `${AUTH_HANDOFF_URL}?app=${encodeURIComponent(appReturn)}`;
}
