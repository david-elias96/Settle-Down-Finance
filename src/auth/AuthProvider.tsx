import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authRequest, backend, PASSKEY_ORIGINS, PASSKEY_RP_ID } from '@/src/lib/backend';
import { handoffRedirect, oauthParams } from '@/src/lib/oauth';
import { CONSENT_NOTICE_VERSION, plaidLinkGate } from '@/src/domain';

type Aal = 'aal1' | 'aal2' | null;

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [aal, setAal] = useState<Aal>(null);
  const [hasFactor, setHasFactor] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [hasAuthenticatorApp, setHasAuthenticatorApp] = useState(false);
  const [consents, setConsents] = useState<string[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [ready, setReady] = useState(!backend);

  const refresh = useCallback(async () => {
    if (!backend) return;
    const { data } = await backend.auth.getSession();
    setSession(data.session);
    if (!data.session) { setAal(null); setHasFactor(false); setHasPasskey(false); setHasAuthenticatorApp(false); setConsents([]); setHouseholdId(null); return; }
    const [{ data: level }, { data: factors }, { data: rows }, { data: membership }] = await Promise.all([
      backend.auth.mfa.getAuthenticatorAssuranceLevel(),
      backend.auth.mfa.listFactors(),
      backend.from('plaid_consents').select('notice_version'),
      backend.from('household_members').select('household_id').eq('user_id', data.session.user.id).order('joined_at').limit(1).maybeSingle(),
    ]);
    setHouseholdId(membership?.household_id ?? null);
    setAal((level?.currentLevel as Aal) ?? 'aal1');
    const passkey = !!factors?.webauthn?.some((f) => f.status === 'verified');
    const totp = !!factors?.totp.some((f) => f.status === 'verified');
    setHasPasskey(passkey);
    setHasAuthenticatorApp(totp);
    setHasFactor(passkey || totp);
    setConsents((rows ?? []).map((r) => r.notice_version));
  }, []);

  useEffect(() => {
    if (!backend) return;
    refresh().finally(() => setReady(true));
    const { data } = backend.auth.onAuthStateChange(() => { refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  /** Sign in with Apple (first factor). Needs a development or TestFlight build. */
  const signInWithApple = async () => {
    if (!backend) throw new Error('Not connected');
    // Loaded lazily so Expo Go previews, which lack the native module, still start.
    const Apple = await import('expo-apple-authentication');
    const cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.EMAIL] });
    if (!cred.identityToken) throw new Error('Apple did not return a sign-in token');
    const { error } = await backend.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) throw error;
  };

  /**
   * Sign in with Google (first factor) through Supabase in the system sign-in sheet. Google
   * sends a one-time code back to the app (PKCE), which is exchanged for a session. Returns
   * false if the person closed the sheet.
   */
  const signInWithGoogle = async () => {
    if (!backend) throw new Error('Not connected');
    const [WebBrowser, Linking] = await Promise.all([import('expo-web-browser'), import('expo-linking')]);
    // Supabase sends the browser to our website, which hands the code back to this app address.
    const appReturn = Linking.createURL('auth-callback');
    const { data, error } = await backend.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: handoffRedirect(appReturn), skipBrowserRedirect: true } });
    if (error) throw error;
    // A private (ephemeral) session skips iOS's "wants to use … to Sign In" alert. The trade-off:
    // it doesn't reuse a Google login from Safari, so people pick or type their Google account here.
    const result = await WebBrowser.openAuthSessionAsync(data.url, appReturn, { preferEphemeralSession: true });
    if (result.type !== 'success') return false;
    const params = oauthParams(result.url);
    if (params.get('error')) throw new Error(params.get('error_description') ?? 'Google sign-in was not completed');
    const code = params.get('code');
    if (!code) throw new Error('Google sign-in did not return a code');
    const { error: exchangeError } = await backend.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return true;
  };

  /** Email sign-in: sends a one-time code, 6 to 10 digits depending on the project's setting (first factor). */
  const sendEmailCode = async (email: string) => {
    if (!backend) throw new Error('Not connected');
    const { error } = await backend.auth.signInWithOtp({ email: email.trim() });
    if (error) throw error;
  };
  const verifyEmailCode = async (email: string, code: string) => {
    if (!backend) throw new Error('Not connected');
    const token = code.replace(/\D/g, '');
    const { error } = await backend.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (!error) return;
    // A brand-new account's first code can be a sign-up confirmation code; try it as one.
    const { error: signupError } = await backend.auth.verifyOtp({ email: email.trim(), token, type: 'signup' });
    if (signupError) throw new Error('That code didn’t work. Use the newest email, or ask for a new code.');
  };

  /** Starts authenticator-app setup. Returns the secret and an otpauth:// link for the authenticator. */
  const startAuthenticatorSetup = async () => {
    if (!backend) throw new Error('Not connected');
    // Drop any half-finished setup first, so the user can retry.
    const { data: existing } = await backend.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === 'unverified') await backend.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await backend.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    if (error) throw error;
    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
  };

  /** Verifies a code from the authenticator app: finishes setup, or steps an existing session up to AAL2. */
  const verifyAuthenticatorCode = async (code: string, factorId?: string) => {
    if (!backend) throw new Error('Not connected');
    const id = factorId ?? (await backend.auth.mfa.listFactors()).data?.totp.find((f) => f.status === 'verified')?.id;
    if (!id) throw new Error('Set up two-step verification first');
    const { error } = await backend.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() });
    if (error) throw error;
    await refresh();
  };

  /**
   * Passkeys (WebAuthn): the phishing-resistant second factor (policy section 4). The passkey is
   * bound to settledownfinancial.com, so a look-alike site can't use it.
   */
  const runPasskey = async (factorId: string) => {
    if (!backend) throw new Error('Not connected');
    // Loaded lazily: the native passkey module exists only in development and TestFlight builds.
    const { Passkey } = await import('react-native-passkey');
    if (!Passkey.isSupported()) throw new Error('Passkeys need iOS 16 or later.');
    const challenge = await authRequest<{
      id: string;
      webauthn: { type: 'create' | 'request'; credential_options: { publicKey: any } };
    }>(`/factors/${factorId}/challenge`, { webauthn: { rpId: PASSKEY_RP_ID, rpOrigins: PASSKEY_ORIGINS } });
    const { type, credential_options } = challenge.webauthn;
    const result = type === 'create' ? await Passkey.create(credential_options.publicKey) : await Passkey.get(credential_options.publicKey);
    // supabase-js serializes the credential with toJSON(); the native module already returns JSON.
    const { error } = await backend.auth.mfa.verify({
      factorId, challengeId: challenge.id,
      webauthn: { rpId: PASSKEY_RP_ID, rpOrigins: PASSKEY_ORIGINS, type, credential_response: { toJSON: () => result } as any },
    } as any);
    if (error) throw error;
    await refresh();
  };

  /** Creates a passkey as this account's second factor and verifies it (session becomes AAL2). */
  const addPasskey = async () => {
    if (!backend) throw new Error('Not connected');
    const { data: existing } = await backend.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === 'unverified') await backend.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await backend.auth.mfa.enroll({ factorType: 'webauthn', friendlyName: 'Passkey' } as any);
    if (error) throw error;
    await runPasskey(data.id);
  };

  /** Steps this session up to AAL2 with the existing passkey. */
  const verifyWithPasskey = async () => {
    if (!backend) throw new Error('Not connected');
    const { data } = await backend.auth.mfa.listFactors();
    const factor = data?.webauthn?.find((f) => f.status === 'verified');
    if (!factor) throw new Error('No passkey set up yet');
    await runPasskey(factor.id);
  };

  /** Records that the user accepted the current data-use notice shown before Plaid Link. */
  const acceptConsent = async () => {
    if (!backend) throw new Error('Not connected');
    const { error } = await backend.from('plaid_consents').upsert({ user_id: session!.user.id, notice_version: CONSENT_NOTICE_VERSION }, { ignoreDuplicates: true });
    if (error) throw error;
    await refresh();
  };

  /** The user's household, created (with the default buckets) on first use. */
  const ensureHousehold = async () => {
    if (!backend) throw new Error('Not connected');
    if (householdId) return householdId;
    const { data, error } = await backend.rpc('create_household', { household_name: 'Our budget' });
    if (error) throw error;
    setHouseholdId(data as string);
    return data as string;
  };

  const signOut = async () => { await backend?.auth.signOut(); await refresh(); };

  const linkGate = plaidLinkGate({ signedIn: !!session, aal, consents });

  return {
    connected: !!backend, ready, session, householdId, ensureHousehold, email: session?.user.email ?? null, aal, hasFactor, hasPasskey, hasAuthenticatorApp, consents, linkGate,
    signInWithApple, signInWithGoogle, sendEmailCode, verifyEmailCode, startAuthenticatorSetup, verifyAuthenticatorCode, addPasskey, verifyWithPasskey, acceptConsent, signOut, refresh,
  };
}

type AuthState = ReturnType<typeof useAuthState>;
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useAuthState()}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

