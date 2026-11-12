import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';

/**
 * Supabase client for the app. Only the project URL and the public anon key ship in the app
 * (policy section 5); everything else stays in edge-function secrets. Without them set, the app
 * runs on sample data (Expo Go previews).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Auth sessions: the iOS Keychain in the app, an encrypted IndexedDB entry under a non-extractable
 * key in the web app (policy section 4). See sessionStorage.ts and sessionStorage.web.ts.
 */
export const backend: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
    // PKCE: Google sign-in returns a one-time code to the app, never tokens in a URL.
    auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
  })
  : null;

/** Calls an edge function as the signed-in user. Throws with the function's error message. */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!backend) throw new Error('The app is not connected to the backend yet.');
  const { data, error } = await backend.functions.invoke(name, { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw Object.assign(new Error(detail?.error ?? error.message), { next: detail?.next });
  }
  return data as T;
}

/** The installable web app (home-screen PWA), hosted on Cloudflare Pages. */
export const WEB_APP_ORIGIN = 'https://app.settledownfinancial.com';

/** Passkeys are bound to our website's domain (relying party). The iOS app is linked to it
 *  through the associated domain in app.json and site/.well-known/apple-app-site-association;
 *  the web app on the app. subdomain can use the same passkeys. */
export const PASSKEY_RP_ID = 'settledownfinancial.com';
export const PASSKEY_ORIGINS = ['https://settledownfinancial.com', WEB_APP_ORIGIN];

/** Calls a Supabase Auth endpoint directly, returning plain JSON (passkey options stay base64url strings). */
export async function authRequest<T>(path: string, body: unknown): Promise<T> {
  if (!backend || !url || !anonKey) throw new Error('The app is not connected to the backend yet.');
  const { data } = await backend.auth.getSession();
  const res = await fetch(`${url}/auth/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${data.session?.access_token ?? anonKey}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.msg ?? json.message ?? json.error_description ?? 'Request failed');
  return json as T;
}

export const PRIVACY_POLICY_URL = 'https://settledownfinancial.com/privacy';
export const PLAID_PRIVACY_URL = 'https://plaid.com/legal/#end-user-privacy-policy';
