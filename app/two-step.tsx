import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';

/**
 * Two-step verification (policy section 4), required before a bank can be linked.
 * A passkey is the default: it is phishing-resistant because it only works with our own domain.
 * An authenticator app (TOTP) is the fallback. `setup=1` adds a second factor; `setup=passkey`
 * adds a passkey to an account that already has an authenticator; otherwise it steps this
 * session up with whichever factor the user has.
 */
export default function TwoStepScreen() {
  const t = useTheme();
  const auth = useAuth();
  const { setup, then } = useLocalSearchParams<{ setup?: string; then?: string }>();
  const enrolling = setup === '1' || setup === 'passkey' || !auth.hasFactor;
  const [useApp, setUseApp] = useState(false);
  const [enrollment, setEnrollment] = useState<{ factorId: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = () => (then === 'connect-bank' ? router.replace('/connect-bank') : router.back());
  const run = async (fn: () => Promise<void>, failTitle: string) => {
    setBusy(true);
    try { await fn(); finish(); } catch (e) { Alert.alert(failTitle, (e as Error).message); } finally { setBusy(false); }
  };

  // Authenticator-app setup starts only when the user picks it.
  useEffect(() => {
    if (enrolling && useApp && auth.session && !enrollment) {
      auth.startAuthenticatorSetup().then(setEnrollment).catch((e) => Alert.alert('Could not start setup', (e as Error).message));
    }
  }, [enrolling, useApp, auth.session]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCodeEntry = enrolling ? useApp : !auth.hasPasskey || useApp;

  return (
    <Screen>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>{enrolling ? 'Set up two-step verification' : 'Confirm it’s you'}</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          {enrolling
            ? 'Bank connections need a second step after sign-in. A passkey uses Face ID and only works with Settle Down, so it can’t be phished.'
            : auth.hasPasskey ? 'Use your passkey to continue.' : 'Open your authenticator app and enter the 6-digit code for Settle Down.'}
        </Label>
      </View>

      {/* Passkey: set up (default) or verify. */}
      {(enrolling ? !useApp : auth.hasPasskey && !useApp) && (
        <Pressable accessibilityRole="button" disabled={busy}
          onPress={() => run(enrolling ? auth.addPasskey : auth.verifyWithPasskey, enrolling ? 'Could not create a passkey' : 'Passkey didn’t work')}
          style={[styles.button, { backgroundColor: busy ? t.track : t.tint }]}>
          <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>{enrolling ? 'Create a passkey' : 'Continue with passkey'}</Label>
        </Pressable>
      )}

      {/* Authenticator app: offered as the alternative when setting up, or when the user has one. */}
      {(enrolling ? setup !== 'passkey' : auth.hasPasskey && auth.hasAuthenticatorApp) && !useApp && (
        <Pressable onPress={() => setUseApp(true)} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Label style={{ color: t.tint }}>{enrolling ? 'Use an authenticator app instead' : 'Use my authenticator app instead'}</Label>
        </Pressable>
      )}

      {enrolling && useApp && enrollment && (
        <Section title="Authenticator app">
          <Pressable onPress={() => Linking.openURL(enrollment.uri).catch(() => Alert.alert('No authenticator app found', 'Enter the setup key by hand instead.'))} accessibilityRole="button">
            <Row icon={{ ios: 'key.fill', android: 'key', web: 'key' }} title="Add to authenticator app" right={<Label style={{ color: t.tint }}>Open</Label>} />
          </Pressable>
          <View style={{ padding: 14, gap: 4 }}>
            <Label secondary style={{ fontSize: 13 }}>Or enter this setup key by hand (press and hold to copy)</Label>
            <Text selectable style={{ fontSize: 15, color: t.text, fontFamily: 'SpaceMono' }}>{enrollment.secret}</Text>
          </View>
        </Section>
      )}

      {showCodeEntry && (!enrolling || enrollment) && (
        <>
          <Section>
            <TextInput accessibilityLabel="6-digit code" value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.secondaryText}
              style={{ padding: 14, fontSize: 17, color: t.text }} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
          </Section>
          <Pressable onPress={() => run(() => auth.verifyAuthenticatorCode(code, enrollment?.factorId), 'That code didn’t work')}
            disabled={busy || code.length < 6} accessibilityRole="button"
            style={[styles.button, { backgroundColor: code.length === 6 ? t.tint : t.track }]}>
            <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Verify</Label>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
});
