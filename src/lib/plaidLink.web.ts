/**
 * Plaid Link in the web app, using Plaid's web SDK (the only script loaded from outside our
 * origin; the CSP in public/_headers allows just cdn.plaid.com). Banks that use OAuth (Chase,
 * Bank of America…) send the whole page to the bank and back to /connect-bank?oauth_state_id=…
 * when PLAID_WEB_REDIRECT_URI is set on the backend; the Link token is kept in this tab's
 * sessionStorage for those few minutes so Link can resume, then removed. It is a short-lived,
 * single-use Link token, never an access token.
 */
import type { PlaidLinkResult } from './plaidLink';

export type { PlaidLinkResult } from './plaidLink';

const SDK = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
const RESUME = 'settledown.plaid-oauth';

type PlaidHandler = { open(): void; destroy(): void };
declare global {
  interface Window {
    Plaid?: { create(config: {
      token: string; receivedRedirectUri?: string;
      onSuccess(publicToken: string, metadata: { institution?: { name?: string } | null }): void;
      onExit(error: unknown): void;
    }): PlaidHandler };
  }
}

let loading: Promise<void> | null = null;
function loadSdk() {
  if (window.Plaid) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('Could not load Plaid. Check your connection and try again.')); };
    document.head.appendChild(s);
  }));
}

export async function openPlaidLink({ token, householdId, receivedRedirectUri }: { token: string; householdId: string; receivedRedirectUri?: string }): Promise<PlaidLinkResult> {
  await loadSdk();
  if (!receivedRedirectUri) {
    try { window.sessionStorage.setItem(RESUME, JSON.stringify({ token, householdId, at: Date.now() })); } catch { /* private mode: OAuth banks can't resume */ }
  }
  return new Promise((resolve) => {
    const finish = (r: PlaidLinkResult) => {
      try { window.sessionStorage.removeItem(RESUME); } catch { /* ignore */ }
      // Resolve first: if Plaid's cleanup throws, linking must still finish.
      resolve(r);
      setTimeout(() => { try { handler.destroy(); } catch { /* already gone */ } }, 0);
    };
    const handler = window.Plaid!.create({
      token,
      receivedRedirectUri,
      onSuccess: (publicToken, metadata) => finish({ publicToken, institutionName: metadata.institution?.name ?? null }),
      onExit: () => finish(null),
    });
    handler.open();
  });
}

/** After a bank's OAuth page sends the person back, the Link session to resume (valid 30 minutes). */
export function pendingOAuthReturn(): { token: string; householdId: string } | null {
  if (!new URLSearchParams(window.location.search).has('oauth_state_id')) return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RESUME) ?? 'null');
    if (!saved || typeof saved.token !== 'string' || typeof saved.householdId !== 'string' || Date.now() - saved.at > 30 * 60_000) return null;
    return { token: saved.token, householdId: saved.householdId };
  } catch {
    return null;
  }
}
