// Rules from the information security policy that both the app and the backend enforce.
// The backend is the real gate; the app uses the same rules to show the right next step.

/** Version of the data-use notice shown before Plaid Link. Bump it when the notice text changes. */
export const CONSENT_NOTICE_VERSION = '2026-11-12.1';

/** Days of history requested from Plaid when a bank is first linked (policy section 3). */
export const PLAID_HISTORY_DAYS = 90;

/** Retention periods from policy section 8. */
export const RETENTION = {
  cancelConversationDays: 30,
  inactiveAccountMonths: 24,
  inactiveNoticeDays: 30,
} as const;

export type LinkGateInput = {
  signedIn: boolean;
  /** Supabase authenticator assurance level of the current session. 'aal2' = second factor used. */
  aal: 'aal1' | 'aal2' | null;
  /** Notice versions the user has accepted. */
  consents: string[];
};

export type LinkGateResult = { ok: true } | { ok: false; next: 'sign_in' | 'second_factor' | 'consent' };

/**
 * Whether Plaid Link may open (policy sections 4 and 8): the user is signed in, has used a
 * second factor in this session, and has accepted the current data-use notice.
 */
export function plaidLinkGate(input: LinkGateInput): LinkGateResult {
  if (!input.signedIn) return { ok: false, next: 'sign_in' };
  if (input.aal !== 'aal2') return { ok: false, next: 'second_factor' };
  if (!input.consents.includes(CONSENT_NOTICE_VERSION)) return { ok: false, next: 'consent' };
  return { ok: true };
}

/**
 * Inactive-account retention (policy section 8). Returns what the retention job should do for
 * a user who last signed in at `lastSignIn`, given when (if ever) they were warned.
 */
export function inactiveAccountAction(lastSignIn: Date, warnedAt: Date | null, now: Date): 'none' | 'warn' | 'delete' {
  const deleteAfter = addMonths(lastSignIn, RETENTION.inactiveAccountMonths);
  const warnFrom = new Date(deleteAfter.getTime() - RETENTION.inactiveNoticeDays * 86_400_000);
  if (now < warnFrom) return 'none';
  // A warning only counts if it was sent after their last sign-in.
  const warned = warnedAt && warnedAt > lastSignIn ? warnedAt : null;
  if (!warned) return 'warn';
  const noticeOver = now.getTime() - warned.getTime() >= RETENTION.inactiveNoticeDays * 86_400_000;
  return now >= deleteAfter && noticeOver ? 'delete' : 'none';
}

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}
