// Server-side gates from the information security policy (sections 4 and 8).
import { admin, HttpError } from './supabase.ts';
import { CONSENT_NOTICE_VERSION } from './domain/index.ts';

/** The signed-in user's session JWT claims. Only call after the token was verified (requireMember/requireUser). */
function claims(req: Request): Record<string, unknown> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const part = token.split('.')[1];
  if (!part) throw new HttpError(401, 'Not signed in');
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
  return JSON.parse(json);
}

/** Verifies the session and returns the user id. */
export async function requireUser(req: Request): Promise<{ userId: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Not signed in');
  return { userId: data.user.id };
}

/**
 * Plaid Link may only be surfaced to a user who used a second factor (authenticator app,
 * Supabase MFA, AAL2) in this session and accepted the current data-use notice.
 */
export async function requirePlaidLinkAllowed(req: Request, userId: string) {
  if (claims(req).aal !== 'aal2') throw new HttpError(403, 'Two-step verification required', { next: 'second_factor' });
  const { count } = await admin.from('plaid_consents').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('notice_version', CONSENT_NOTICE_VERSION);
  if (!count) throw new HttpError(403, 'Consent required', { next: 'consent' });
}

/** Constant-time check of a scheduler's shared secret. Fails closed when the secret is unset. */
export function requireCronSecret(req: Request) {
  const secret = Deno.env.get('CRON_SECRET');
  const given = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${secret}`;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < Math.min(given.length, expected.length); i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  if (!secret || diff !== 0) throw new HttpError(401, 'Unauthorized');
}
