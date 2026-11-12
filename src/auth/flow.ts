// Sign-in rules shared by the route guard (app/_layout.tsx), AuthProvider and the sign-in screens.
// Kept free of React and Supabase so they can be tested on their own.

export type Aal = 'aal1' | 'aal2';

export type AuthStageInput = {
  /** False in development previews without backend settings (sample data only). */
  connected: boolean;
  /** The saved session has been read and checked. */
  ready: boolean;
  signedIn: boolean;
  /** Assurance level of this session ('aal2' once a second factor was used). */
  currentLevel: Aal | null;
  /** Level this account can reach: 'aal2' when it has a verified passkey or authenticator app. */
  nextLevel: Aal | null;
};

/**
 * Where someone is in signing in. Decides which screens the route guard opens:
 * - preview: no backend (Expo Go without settings). The whole app runs on sample data.
 * - loading: the saved session is still being read; show nothing yet.
 * - signed_out: only the sign-in flow.
 * - step_up: signed in, but the account has two-step verification that this session hasn't
 *   used yet. Sign-in isn't finished until it does, the way banking apps work.
 * - signed_in: the app.
 */
export type AuthStage = 'preview' | 'loading' | 'signed_out' | 'step_up' | 'signed_in';

export function authStage(s: AuthStageInput): AuthStage {
  if (!s.connected) return 'preview';
  if (!s.ready) return 'loading';
  if (!s.signedIn) return 'signed_out';
  if (s.nextLevel === 'aal2' && s.currentLevel !== 'aal2') return 'step_up';
  return 'signed_in';
}

/** A plain check that an address looks like an email before asking for a code. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Supabase lets each address ask for a new code once a minute. */
export const EMAIL_RESEND_SECONDS = 60;

/** Seconds to wait from a rate-limit error ("…you can only request this after 42 seconds"). */
export function retryAfterSeconds(e: unknown): number | null {
  const m = /after (\d+) seconds?/i.exec(messageOf(e));
  return m ? Number(m[1]) : null;
}

/**
 * What to tell someone when a sign-in step fails, in plain words. Returns null when they
 * cancelled it themselves (closed the Apple sheet, dismissed Face ID), which needs no message.
 * Never echoes server text we don't recognise, so error details stay off the screen.
 */
export function authErrorMessage(e: unknown): string | null {
  const msg = messageOf(e);
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const name = String((e as { name?: unknown } | null)?.name ?? '');

  if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED' || name === 'AbortError' || name === 'NotAllowedError'
    || /cancel+ed|user ?cancel|not allowed by the user agent|timed out or was not allowed/i.test(msg)) return null;

  // Our own messages (thrown in AuthProvider) are already written for people.
  if ((e as { friendly?: boolean } | null)?.friendly) return msg;
  const wait = retryAfterSeconds(e);
  if (wait != null) return `Please wait ${wait} seconds, then try again.`;
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a minute, then try again.';
  if (/network|failed to fetch|load failed|offline/i.test(msg)) return 'Couldn’t reach Settle Down. Check your connection and try again.';
  if (/totp|mfa_verification|mfa/i.test(`${msg} ${code}`)) return 'That code didn’t match. Check the code in your authenticator app for Settle Down and try again.';
  if (/expired|invalid.*(otp|token|code)|(otp|token|code).*invalid/i.test(msg)) return 'That code didn’t work. Use the code in the newest email, or ask for a new one.';
  if (/passkey|webauthn|credential/i.test(msg)) return 'Your passkey didn’t work here. Try again, or use your authenticator app if you set one up.';
  return 'Something went wrong signing in. Please try again.';
}

/** An error whose message is meant to be shown as is. */
export function friendlyError(message: string): Error {
  return Object.assign(new Error(message), { friendly: true });
}

function messageOf(e: unknown): string {
  if (typeof e === 'string') return e;
  return String((e as { message?: unknown } | null)?.message ?? '');
}
