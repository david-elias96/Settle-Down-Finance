import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { authRequest, backend, callFunction, PASSKEY_ORIGINS, PASSKEY_RP_ID } from '@/src/lib/backend';
import { createPasskey, getPasskey, passkeySupported } from '@/src/lib/passkey';
import { handoffRedirect, oauthParams } from '@/src/lib/oauth';
import { prefs } from '@/src/lib/prefs';
import { registerPushToken, unregisterPushToken } from '@/src/notifications';
import { CONSENT_NOTICE_VERSION, plaidLinkGate } from '@/src/domain';
import { authStage, friendlyError, type Aal } from './flow';

/** Whether the "Link your banks" welcome shows after sign-in. Decided once per account. */
type Onboarding = 'unknown' | 'needed' | 'done';
const onboardingKey = (userId: string) => `onboarding-done.${userId}`;
/** An invite code opened before signing in, so the join page comes back after sign-in. */
const PENDING_INVITE = 'pending-invite';
/** Set after "Delete my account", so the sign-in screen can say the account is gone. Not personal data. */
const ACCOUNT_DELETED = 'account-deleted';
/** An account this young is new: the welcome says so (a deleted account's email makes a fresh one). */
const NEW_ACCOUNT_MS = 15 * 60 * 1000;

type Account = {
  currentLevel: Aal | null;
  nextLevel: Aal | null;
  hasPasskey: boolean;
  hasAuthenticatorApp: boolean;
  consents: string[];
  householdId: string | null;
  /** Banks linked to the household; null until known. */
  linkedBanks: number | null;
};
const SIGNED_OUT: Account = { currentLevel: null, nextLevel: null, hasPasskey: false, hasAuthenticatorApp: false, consents: [], householdId: null, linkedBanks: null };

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account>(SIGNED_OUT);
  const [onboarding, setOnboarding] = useState<Onboarding>('unknown');
  const [ready, setReady] = useState(!backend);
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  /** Only the newest refresh may write state, so a slow older one can't undo a newer one. */
  const seq = useRef(0);
  const userRef = useRef<string | null>(null);
  const householdRef = useRef<string | null>(null);
  const [pendingInvite, setPendingInviteState] = useState<string | null>(null);

  useEffect(() => { prefs.get(PENDING_INVITE).then((c) => { if (c && /^[A-Z0-9]{8}$/.test(c)) setPendingInviteState(c); }); }, []);
  /** Remembers (or forgets) an invite code across sign-in. */
  const setPendingInvite = async (code: string | null) => {
    setPendingInviteState(code);
    if (code) await prefs.set(PENDING_INVITE, code); else await prefs.remove(PENDING_INVITE);
  };
  useEffect(() => { passkeySupported().then(setPasskeysAvailable, () => setPasskeysAvailable(false)); }, []);

  /** Reads the session and everything sign-in depends on. A query that fails keeps the last known value. */
  const refresh = useCallback(async () => {
    if (!backend) return;
    const mine = ++seq.current;
    const { data } = await backend.auth.getSession();
    if (mine !== seq.current) return;
    const s = data.session;
    if (!s) {
      userRef.current = null;
      householdRef.current = null;
      setSession(null); setAccount(SIGNED_OUT); setOnboarding('unknown');
      return;
    }
    const newUser = userRef.current !== s.user.id;
    userRef.current = s.user.id;
    const [level, factors, consentRows, membership, welcomed] = await Promise.all([
      backend.auth.mfa.getAuthenticatorAssuranceLevel(),
      backend.auth.mfa.listFactors(),
      backend.from('plaid_consents').select('notice_version'),
      backend.from('household_members').select('household_id').eq('user_id', s.user.id).order('joined_at').limit(1).maybeSingle(),
      prefs.get(onboardingKey(s.user.id)),
    ]);
    const householdId = membership.error ? undefined : (membership.data?.household_id ?? null);
    const banks = householdId
      ? await backend.from('linked_institutions').select('id', { count: 'exact', head: true }).eq('household_id', householdId)
      : null;
    if (mine !== seq.current) return;

    const linkedNow = householdId === null ? 0 : banks && !banks.error ? banks.count ?? 0 : null;
    // Joining someone else's household (an invite) decides the welcome again: theirs may have banks.
    const joinedHousehold = !!householdId && !!householdRef.current && householdId !== householdRef.current;
    if (householdId !== undefined) householdRef.current = householdId;
    setAccount((prev) => {
      const base = newUser ? SIGNED_OUT : prev;
      return {
        // The level comes from the session itself; if it can't be read, keep what we knew rather than dropping to aal1.
        currentLevel: level.error ? base.currentLevel : (level.data?.currentLevel as Aal) ?? null,
        nextLevel: level.error ? base.nextLevel : (level.data?.nextLevel as Aal) ?? null,
        hasPasskey: factors.error ? base.hasPasskey : !!factors.data?.webauthn?.some((f) => f.status === 'verified'),
        hasAuthenticatorApp: factors.error ? base.hasAuthenticatorApp : !!factors.data?.totp.some((f) => f.status === 'verified'),
        consents: consentRows.error ? base.consents : (consentRows.data ?? []).map((r) => r.notice_version),
        householdId: householdId === undefined ? base.householdId : householdId,
        linkedBanks: linkedNow ?? base.linkedBanks,
      };
    });
    setSession(s);
    // The welcome is decided once per account: shown when the household has no banks yet and
    // the person hasn't finished it before. Linking a bank doesn't close it; Done does.
    setOnboarding((prev) => {
      if (!newUser && !joinedHousehold && prev !== 'unknown') return prev;
      if (welcomed) return 'done';
      if (linkedNow == null) return 'unknown';
      return linkedNow === 0 ? 'needed' : 'done';
    });
  }, []);

  useEffect(() => {
    if (!backend) return;
    refresh().catch(() => {}).finally(() => setReady(true));
    const { data } = backend.auth.onAuthStateChange((event: AuthChangeEvent, s) => {
      // A routine token refresh changes nothing we show; just keep the newer session.
      if (event === 'TOKEN_REFRESHED') { if (s) setSession(s); return; }
      // Supabase holds a lock while it calls us: run other auth calls after it returns, or they wait forever.
      setTimeout(() => { refresh().catch(() => {}); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  /** Sign in with Apple (first factor). iOS only; needs a development or TestFlight build. */
  const appleAvailable = async () => {
    if (Platform.OS !== 'ios' || !backend) return false;
    try {
      const Apple = await import('expo-apple-authentication');
      return await Apple.isAvailableAsync();
    } catch {
      return false; // Expo Go without the native module
    }
  };
  const signInWithApple = async () => {
    if (!backend) throw friendlyError('Not connected');
    // Loaded lazily so Expo Go previews, which lack the native module, still start.
    const [Apple, Crypto] = await Promise.all([import('expo-apple-authentication'), import('expo-crypto')]);
    // Apple signs a hash of this one-time value into its token, and Supabase checks it against the
    // raw value, so a token taken from somewhere else can't be replayed here.
    const nonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.EMAIL], nonce: hashedNonce });
    if (!cred.identityToken) throw friendlyError('Apple didn’t finish signing you in. Please try again.');
    const { error } = await backend.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce });
    if (error) throw error;
  };

  /**
   * Sign in with Google (first factor) through Supabase in the system sign-in sheet. Google
   * sends a one-time code back to the app (PKCE), which is exchanged for a session. Closing the
   * sheet just returns; the route guard takes it from there once a session exists.
   */
  const signInWithGoogle = async () => {
    if (!backend) throw friendlyError('Not connected');
    // Google always asks which account to use, so signing in (or starting over after deleting an
    // account) is a deliberate choice, not one silent tap on whichever account the browser remembers.
    const queryParams = { prompt: 'select_account' };
    if (Platform.OS === 'web') {
      // Web app: the whole page goes to Google and comes back to /auth-callback?code=…, which
      // calls finishWebSignIn. The PKCE verifier waits in the encrypted session store.
      const { error } = await backend.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth-callback`, queryParams } });
      if (error) throw error;
      return;
    }
    const [WebBrowser, Linking] = await Promise.all([import('expo-web-browser'), import('expo-linking')]);
    // Supabase sends the browser to our website, which hands the code back to this app address.
    const appReturn = Linking.createURL('auth-callback');
    const { data, error } = await backend.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: handoffRedirect(appReturn), skipBrowserRedirect: true, queryParams } });
    if (error) throw error;
    // A private (ephemeral) session skips iOS's "wants to use … to Sign In" alert. The trade-off:
    // it doesn't reuse a Google login from Safari, so people pick or type their Google account here.
    const result = await WebBrowser.openAuthSessionAsync(data.url, appReturn, { preferEphemeralSession: true });
    if (result.type !== 'success') return;
    const params = oauthParams(result.url);
    if (params.get('error')) throw friendlyError('Google sign-in wasn’t finished. Please try again.');
    const code = params.get('code');
    if (!code) throw friendlyError('Google sign-in wasn’t finished. Please try again.');
    const { error: exchangeError } = await backend.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    await refresh();
  };

  /** Web app: exchanges the code Google sign-in sent back. The route guard picks the next screen. */
  const finishWebSignIn = async (code: string) => {
    if (!backend) throw friendlyError('Not connected');
    const { error } = await backend.auth.exchangeCodeForSession(code);
    if (error) throw error;
    await refresh();
  };

  /** Email sign-in: sends a one-time code, 6 to 10 digits depending on the project's setting (first factor). */
  const sendEmailCode = async (email: string) => {
    if (!backend) throw friendlyError('Not connected');
    const { error } = await backend.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    if (error) throw error;
  };
  const verifyEmailCode = async (email: string, code: string) => {
    if (!backend) throw friendlyError('Not connected');
    const token = code.replace(/\D/g, '');
    const address = email.trim().toLowerCase();
    const { error } = await backend.auth.verifyOtp({ email: address, token, type: 'email' });
    if (error) {
      // A brand-new account's first code can be a sign-up confirmation code; try it as one.
      const { error: signupError } = await backend.auth.verifyOtp({ email: address, token, type: 'signup' });
      if (signupError) throw error;
    }
    await refresh();
  };

  /** Starts authenticator-app setup. Returns the secret and an otpauth:// link for the authenticator. */
  const startAuthenticatorSetup = async () => {
    if (!backend) throw friendlyError('Not connected');
    // Drop any half-finished setup first, so the user can retry.
    const { data: existing } = await backend.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === 'unverified') await backend.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await backend.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    if (error) throw error;
    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
  };

  /** Verifies a code from the authenticator app: finishes setup, or steps an existing session up to AAL2. */
  const verifyAuthenticatorCode = async (code: string, factorId?: string) => {
    if (!backend) throw friendlyError('Not connected');
    const id = factorId ?? (await backend.auth.mfa.listFactors()).data?.totp.find((f) => f.status === 'verified')?.id;
    if (!id) throw friendlyError('Set up two-step verification first.');
    const { error } = await backend.auth.mfa.challengeAndVerify({ factorId: id, code: code.replace(/\D/g, '') });
    if (error) throw error;
    await refresh();
  };

  /**
   * Passkeys (WebAuthn): the phishing-resistant second factor (policy section 4). The passkey is
   * bound to settledownfinancial.com, so a look-alike site can't use it.
   */
  const runPasskey = async (factorId: string) => {
    if (!backend) throw friendlyError('Not connected');
    // Native module in the app (development and TestFlight builds), WebAuthn in the web app.
    if (!(await passkeySupported())) throw Object.assign(friendlyError('Passkeys aren’t available here. Use an authenticator app instead.'), { passkeyUnavailable: true });
    const challenge = await authRequest<{
      id: string;
      webauthn: { type: 'create' | 'request'; credential_options: { publicKey: any } };
    }>(`/factors/${factorId}/challenge`, { webauthn: { rpId: PASSKEY_RP_ID, rpOrigins: PASSKEY_ORIGINS } });
    const { type, credential_options } = challenge.webauthn;
    const result = type === 'create' ? await createPasskey(credential_options.publicKey) : await getPasskey(credential_options.publicKey);
    // supabase-js serializes the credential with toJSON(); both helpers already return JSON.
    const { error } = await backend.auth.mfa.verify({
      factorId, challengeId: challenge.id,
      webauthn: { rpId: PASSKEY_RP_ID, rpOrigins: PASSKEY_ORIGINS, type, credential_response: { toJSON: () => result } as any },
    } as any);
    if (error) throw error;
    await refresh();
  };

  /** Creates a passkey as this account's second factor and verifies it (session becomes AAL2). */
  const addPasskey = async () => {
    if (!backend) throw friendlyError('Not connected');
    const { data: existing } = await backend.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === 'unverified') await backend.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await backend.auth.mfa.enroll({ factorType: 'webauthn', friendlyName: 'Passkey' } as any);
    if (error) throw error;
    try {
      await runPasskey(data.id);
    } catch (e) {
      // Don't leave a half-made passkey behind (it would block trying again).
      await backend.auth.mfa.unenroll({ factorId: data.id }).catch(() => {});
      throw e;
    }
  };

  /** Steps this session up to AAL2 with the existing passkey. */
  const verifyWithPasskey = async () => {
    if (!backend) throw friendlyError('Not connected');
    const { data } = await backend.auth.mfa.listFactors();
    const factor = data?.webauthn?.find((f) => f.status === 'verified');
    if (!factor) throw friendlyError('No passkey set up yet.');
    await runPasskey(factor.id);
  };

  /** Records that the user accepted the current data-use notice shown before Plaid Link. */
  const acceptConsent = async () => {
    if (!backend || !session) throw friendlyError('Not connected');
    const { error } = await backend.from('plaid_consents').upsert({ user_id: session.user.id, notice_version: CONSENT_NOTICE_VERSION }, { ignoreDuplicates: true });
    if (error) throw error;
    await refresh();
  };

  /** The user's household, created (with the default buckets) on first use. */
  const ensureHousehold = async () => {
    if (!backend) throw friendlyError('Not connected');
    if (account.householdId) return account.householdId;
    const { data, error } = await backend.rpc('create_household', { household_name: 'Our budget' });
    if (error) throw error;
    setAccount((a) => ({ ...a, householdId: data as string, linkedBanks: 0 }));
    return data as string;
  };

  /** Joins a household with an invite code (the invited person, signed in). */
  const acceptInvite = async (code: string, displayName: string) => {
    if (!backend) throw friendlyError('Not connected');
    const { error } = await backend.rpc('accept_invite', { p_code: code, p_display_name: displayName.trim() || null });
    // The database's own messages here are written for people ("This invite has expired…").
    if (error) throw friendlyError(/expired|already used|sign in/i.test(error.message) ? error.message : 'Couldn’t join with that invite. Ask for a new one.');
    await setPendingInvite(null);
    await refresh();
  };

  /** Creates a single-use invite code for this household (valid 7 days). */
  const createInvite = async () => {
    if (!backend) throw friendlyError('Not connected');
    const householdId = await ensureHousehold();
    const { data, error } = await backend.rpc('create_invite', { p_household: householdId });
    if (error || typeof data !== 'string') throw friendlyError('Couldn’t make an invite. Check your connection and try again.');
    return data;
  };

  /** Closes the "Link your banks" welcome for good (on this device). */
  const finishOnboarding = async () => {
    setOnboarding('done');
    if (session) await prefs.set(onboardingKey(session.user.id), '1');
  };

  /** Turns on purchase alerts on this phone (asks for permission). */
  const turnOnAlerts = async () => {
    if (!backend || !session) throw friendlyError('Sign in first.');
    return registerPushToken(backend, session.user.id, true);
  };

  // Keep this phone's push token current once alerts are allowed (tokens can change).
  const userId = session?.user.id;
  useEffect(() => {
    if (backend && userId) registerPushToken(backend, userId, false).catch(() => {});
  }, [userId]);

    /** Signs out on this device only (other devices stay signed in). */
  // Shown once on the sign-in screen after deleting an account.
  const [accountDeleted, setAccountDeleted] = useState(false);
  useEffect(() => { prefs.get(ACCOUNT_DELETED).then((v) => setAccountDeleted(v === '1')); }, []);
  const clearAccountDeleted = () => { setAccountDeleted(false); prefs.remove(ACCOUNT_DELETED); };
  // Signing in again (a fresh account) retires the message.
  const signedInUser = session?.user.id;
  useEffect(() => { if (signedInUser) { setAccountDeleted(false); prefs.remove(ACCOUNT_DELETED); } }, [signedInUser]);

  /**
   * Deletes the account (banks at Plaid, data and login, through the delete-account function),
   * then signs out. The sign-in screen then says the account is gone and that signing in again
   * starts a fresh, empty account.
   */
  const deleteAccount = async () => {
    if (!backend || !session) throw friendlyError('Sign in first.');
    await callFunction('delete-account', { confirm: 'DELETE' });
    await prefs.set(ACCOUNT_DELETED, '1');
    setAccountDeleted(true);
    await backend.auth.signOut({ scope: 'local' }).catch(() => {});
    await refresh();
  };

  const signOut = async () => {
    // This phone stops getting the account's alerts once it's signed out.
    if (backend && session) await unregisterPushToken(backend, session.user.id).catch(() => {});
    await backend?.auth.signOut({ scope: 'local' });
    await refresh();
  };

  const stage = authStage({ connected: !!backend, ready, signedIn: !!session, currentLevel: account.currentLevel, nextLevel: account.nextLevel });
  const aal = session ? account.currentLevel ?? 'aal1' : null;
  const hasFactor = account.hasPasskey || account.hasAuthenticatorApp;
  const linkGate = plaidLinkGate({ signedIn: !!session, aal, consents: account.consents });

  return {
    connected: !!backend, ready, stage, session, email: session?.user.email ?? null, aal,
    householdId: account.householdId, linkedBanks: account.linkedBanks, hasFactor, hasPasskey: account.hasPasskey,
    hasAuthenticatorApp: account.hasAuthenticatorApp, consents: account.consents, linkGate, passkeysAvailable,
    /** Signed in, and the welcome that asks them to link a bank should show. */
    needsOnboarding: stage === 'signed_in' && onboarding === 'needed',
    /** Signed in to an account created in the last few minutes (first sign-in). */
    isNewAccount: !!session && Date.now() - new Date(session.user.created_at).getTime() < NEW_ACCOUNT_MS,
    accountDeleted, clearAccountDeleted, deleteAccount,
    appleAvailable, signInWithApple, signInWithGoogle, finishWebSignIn, sendEmailCode, verifyEmailCode,
    startAuthenticatorSetup, verifyAuthenticatorCode, addPasskey, verifyWithPasskey, acceptConsent,
    ensureHousehold, finishOnboarding, signOut, refresh,
    pendingInvite, setPendingInvite, acceptInvite, createInvite, turnOnAlerts,
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
