/** Query and fragment parameters of a sign-in redirect URL, e.g. settledown://auth-callback?code=… */
export function oauthParams(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const query = url.split('#')[0].split('?')[1] ?? '';
  const fragment = url.split('#')[1] ?? '';
  for (const part of [query, fragment]) new URLSearchParams(part).forEach((v, k) => out.set(k, v));
  return out;
}
