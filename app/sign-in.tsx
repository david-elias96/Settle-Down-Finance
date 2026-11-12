import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, fieldStyle, Intro, Label, Notice, radius, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { authErrorMessage, EMAIL_RESEND_SECONDS, looksLikeEmail, retryAfterSeconds } from '@/src/auth/flow';
import { prefs } from '@/src/lib/prefs';

/** The address a code was sent to, kept so coming back from Mail (or a web-app reload) keeps their place. */
const PENDING_EMAIL = 'sign-in.pending-email';
/** Codes expire, so after this the pending address is forgotten. */
const PENDING_FOR_MS = 15 * 60 * 1000;

/**
 * Sign in with Apple, Google, or a one-time code sent by email. This screen never navigates:
 * once a session exists, the route guard in app/_layout.tsx opens the next step (two-step
 * verification for accounts that have it, the "Link your banks" welcome, or the app).
 */
export default function SignInScreen() {
  const t = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apple, setApple] = useState(false);
  /** When a new code may be requested (ms since epoch). */
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { auth.appleAvailable().then(setApple); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up where they left off if they went to Mail for the code.
  useEffect(() => {
    prefs.get(PENDING_EMAIL).then((raw) => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw) as { email: string; at: number };
        if (Date.now() - p.at < PENDING_FOR_MS && looksLikeEmail(p.email)) {
          setEmail(p.email); setSent(true); setResendAt(p.at + EMAIL_RESEND_SECONDS * 1000);
        } else prefs.remove(PENDING_EMAIL);
      } catch { prefs.remove(PENDING_EMAIL); }
    });
  }, []);

  const waiting = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) {
      const wait = retryAfterSeconds(e);
      if (wait) { setResendAt(Date.now() + wait * 1000); setNow(Date.now()); }
      const msg = authErrorMessage(e);
      if (msg) Alert.alert('Sign-in didn’t work', msg);
    } finally { setBusy(false); }
  };

  const sendCode = async () => {
    await auth.sendEmailCode(email);
    const at = Date.now();
    setSent(true); setCode(''); setResendAt(at + EMAIL_RESEND_SECONDS * 1000); setNow(at);
    await prefs.set(PENDING_EMAIL, JSON.stringify({ email: email.trim().toLowerCase(), at }));
  };
  const verify = async () => {
    await auth.verifyEmailCode(email, code);
    await prefs.remove(PENDING_EMAIL);
  };
  const changeEmail = () => { setSent(false); setCode(''); setResendAt(0); prefs.remove(PENDING_EMAIL); };

  if (!auth.connected) {
    return (
      <Screen>
        <Notice title="Sign-in isn't on yet">Sign-in turns on once the app is connected to the backend.</Notice>
      </Screen>
    );
  }

  const codeDigits = code.replace(/\D/g, '').length;
  const emailOk = looksLikeEmail(email);

  return (
    <Screen keyboardDone>
      <Intro title="Welcome to Settle Down">
        Sign in to see your household's budget. New here? Signing in creates your account.
      </Intro>
      {/* Right after "Delete my account": say it worked, and what signing in again means. */}
      {auth.accountDeleted && (
        <>
          <Notice title="Your account was deleted" icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}>
            Your banks were removed at Plaid and your data was deleted. Signing in again, even with the same Google account or email, starts a fresh, empty account.
          </Notice>
          <Button title="OK" variant="secondary" onPress={auth.clearAccountDeleted} />
        </>
      )}
      {apple && !sent && (
        <Button title="Sign in with Apple" icon={{ ios: 'apple.logo', android: 'login', web: 'login' }} disabled={busy}
          onPress={() => run(auth.signInWithApple)} style={{ backgroundColor: busy ? t.track : t.text }} textColor={t.background} />
      )}
      {!sent && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(auth.signInWithGoogle)}
          accessibilityLabel="Continue with Google"
          style={({ pressed }) => [styles.google, { backgroundColor: t.card, borderColor: t.separator, opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <GoogleMark />
          <Label style={{ fontSize: 17, fontWeight: '600' }}>Continue with Google</Label>
        </Pressable>
      )}
      <Section title={sent ? `Code sent to ${email.trim()}` : 'Or use your email'}
        footer={sent ? 'Enter the code from the newest email. It can take a minute to arrive; check spam too.' : "We'll email you a sign-in code. No password needed."}>
        {!sent ? (
          <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.secondaryText}
            style={[fieldStyle, { color: t.text }]} autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            keyboardType="email-address" returnKeyType="send" onSubmitEditing={() => { if (emailOk && !busy) run(sendCode); }} />
        ) : (
          <TextInput accessibilityLabel="Code from email" value={code} onChangeText={setCode} placeholder="12345678" placeholderTextColor={t.secondaryText}
            style={[fieldStyle, { color: t.text, fontVariant: ['tabular-nums'], letterSpacing: 2 }]} keyboardType="number-pad"
            textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} autoFocus
            returnKeyType="done" onSubmitEditing={() => { if (codeDigits >= 6 && !busy) run(verify); }} />
        )}
      </Section>
      <Button title={sent ? 'Sign in' : 'Email me a code'} loading={busy} disabled={busy || (sent ? codeDigits < 6 : !emailOk)}
        onPress={() => run(sent ? verify : sendCode)} />
      {sent && (
        <>
          <Button title={waiting ? `Send a new code in ${waiting}s` : 'Send a new code'} variant="plain" disabled={busy || waiting > 0}
            onPress={() => run(async () => { await sendCode(); Alert.alert('New code sent', 'Check your email. Earlier codes no longer work.'); })} />
          <Button title="Use a different email" variant="plain" disabled={busy} onPress={changeEmail} />
        </>
      )}
    </Screen>
  );
}

/** Google's "G" mark, in its four brand colors (as Google's sign-in branding guidelines require). */
function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 22, borderWidth: 1 },
});
