import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, fieldStyle, Intro, KEYBOARD_DONE_ID, KeyboardDone, Label, Notice, radius, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';

/** Sign in with Apple, Google, or a one-time code sent by email. Two-step verification comes next. */
export default function SignInScreen() {
  const t = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert('Sign-in failed', (e as Error).message); } finally { setBusy(false); }
  };
  const done = () => router.replace(auth.hasFactor ? '/two-step' : '/two-step?setup=1');

  if (!auth.connected) {
    return (
      <Screen>
        <Notice title="Sign-in isn't on yet">Sign-in turns on once the app is connected to the backend.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <Intro title="Sign in">
        Your budget is tied to your account. Next you'll confirm it's you with a passkey (Face ID) before any bank is connected.
      </Intro>
      {Platform.OS === 'ios' && (
        <Button title="Sign in with Apple" icon={{ ios: 'apple.logo', android: 'login', web: 'login' }} disabled={busy}
          onPress={() => run(async () => { await auth.signInWithApple(); done(); })} style={{ backgroundColor: busy ? t.track : t.text }} textColor={t.background} />
      )}
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={() => run(async () => { if (await auth.signInWithGoogle()) done(); })}
        accessibilityLabel="Continue with Google"
        style={({ pressed }) => [styles.google, { backgroundColor: t.card, borderColor: t.separator, opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <GoogleMark />
        <Label style={{ fontSize: 17, fontWeight: '600' }}>Continue with Google</Label>
      </Pressable>
      <Section title="Or use your email" footer={sent ? 'Enter the code we emailed you. Only the newest email works.' : "We'll email you a sign-in code."}>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.secondaryText}
          style={[fieldStyle, { color: t.text, borderBottomWidth: sent ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.separator }]} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!sent} />
        {sent && (
          <TextInput accessibilityLabel="Code from email" value={code} onChangeText={setCode} placeholder="12345678" placeholderTextColor={t.secondaryText}
            style={[fieldStyle, { color: t.text, fontVariant: ['tabular-nums'], letterSpacing: 2 }]} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} inputAccessoryViewID={KEYBOARD_DONE_ID} returnKeyType="done" />
        )}
      </Section>
      <Button title={sent ? 'Sign in' : 'Email me a code'} disabled={busy || (sent ? code.replace(/\D/g, '').length < 6 : !email.includes('@'))}
        onPress={() => run(async () => {
          if (!sent) { await auth.sendEmailCode(email); setSent(true); } else { await auth.verifyEmailCode(email, code); done(); }
        })} />
      {sent && (
        <Button title="Send a new code" variant="plain" disabled={busy}
          onPress={() => run(async () => { setCode(''); await auth.sendEmailCode(email); Alert.alert('New code sent', 'Check your email. Earlier codes no longer work.'); })} />
      )}
      <KeyboardDone />
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
