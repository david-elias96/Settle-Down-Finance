import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Label, Screen, Section, useTheme } from '@/components/ui';
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
        <Label secondary style={{ paddingHorizontal: 4 }}>Sign-in turns on once the app is connected to the backend.</Label>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>Sign in</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          Your budget is tied to your account. Next you'll set up two-step verification with an authenticator app.
        </Label>
      </View>
      {Platform.OS === 'ios' && (
        <Pressable onPress={() => run(async () => { await auth.signInWithApple(); done(); })} disabled={busy} accessibilityRole="button"
          style={[styles.button, { backgroundColor: t.text }]}>
          <Label style={{ color: t.background, fontSize: 17, fontWeight: '600' }}>Sign in with Apple</Label>
        </Pressable>
      )}
      <Section title="Or use your email" footer={sent ? 'Enter the 6-digit code we emailed you.' : "We'll email you a 6-digit code."}>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.secondaryText}
          style={[styles.input, { color: t.text }]} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!sent} />
        {sent && (
          <TextInput accessibilityLabel="Code from email" value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.secondaryText}
            style={[styles.input, { color: t.text }]} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
        )}
      </Section>
      <Pressable accessibilityRole="button" disabled={busy || (sent ? code.length < 6 : !email.includes('@'))}
        onPress={() => run(async () => {
          if (!sent) { await auth.sendEmailCode(email); setSent(true); } else { await auth.verifyEmailCode(email, code); done(); }
        })}
        style={[styles.button, { backgroundColor: (sent ? code.length === 6 : email.includes('@')) ? t.tint : t.track }]}>
        <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>{sent ? 'Sign in' : 'Email me a code'}</Label>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  input: { padding: 14, fontSize: 17 },
});
