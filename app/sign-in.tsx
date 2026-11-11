import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput } from 'react-native';
import { Button, fieldStyle, Intro, Notice, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';

/** Sign in with Apple, or with a 6-digit code sent by email. Two-step verification comes next. */
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
      <Section title="Or use your email" footer={sent ? 'Enter the 6-digit code we emailed you.' : "We'll email you a 6-digit code."}>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.secondaryText}
          style={[fieldStyle, { color: t.text, borderBottomWidth: sent ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.separator }]} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!sent} />
        {sent && (
          <TextInput accessibilityLabel="Code from email" value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.secondaryText}
            style={[fieldStyle, { color: t.text, fontVariant: ['tabular-nums'], letterSpacing: 2 }]} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
        )}
      </Section>
      <Button title={sent ? 'Sign in' : 'Email me a code'} disabled={busy || (sent ? code.length < 6 : !email.includes('@'))}
        onPress={() => run(async () => {
          if (!sent) { await auth.sendEmailCode(email); setSent(true); } else { await auth.verifyEmailCode(email, code); done(); }
        })} />
    </Screen>
  );
}
