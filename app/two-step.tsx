import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Text, TextInput, View } from 'react-native';
import { Button, fieldStyle, IconChip, Intro, Label, ListRow, Screen, Section, useTheme } from '@/components/ui';
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
      <Intro title={enrolling ? 'Set up two-step verification' : 'Confirm it’s you'}>
        {enrolling
          ? 'Bank connections need a second step after sign-in. A passkey uses Face ID and only works with Settle Down, so it can’t be phished.'
          : auth.hasPasskey ? 'Use your passkey to continue.' : 'Open your authenticator app and enter the 6-digit code for Settle Down.'}
      </Intro>

      {/* Passkey: set up (default) or verify. */}
      {(enrolling ? !useApp : auth.hasPasskey && !useApp) && (
        <Button title={enrolling ? 'Create a passkey' : 'Continue with passkey'} icon={{ ios: 'faceid', android: 'fingerprint', web: 'fingerprint' }} disabled={busy}
          onPress={() => run(enrolling ? auth.addPasskey : auth.verifyWithPasskey, enrolling ? 'Could not create a passkey' : 'Passkey didn’t work')} />
      )}

      {/* Authenticator app: offered as the alternative when setting up, or when the user has one. */}
      {(enrolling ? setup !== 'passkey' : auth.hasPasskey && auth.hasAuthenticatorApp) && !useApp && (
        <Button variant="secondary" title={enrolling ? 'Use an authenticator app instead' : 'Use my authenticator app instead'}
          icon={{ ios: 'key.fill', android: 'key', web: 'key' }} onPress={() => setUseApp(true)} style={{ marginTop: -12 }} />
      )}

      {enrolling && useApp && enrollment && (
        <Section title="Authenticator app">
          <ListRow title="Add to authenticator app" note="Opens the app with Settle Down filled in"
            leading={<IconChip icon={{ ios: 'key.fill', android: 'key', web: 'key' }} />}
            onPress={() => Linking.openURL(enrollment.uri).catch(() => Alert.alert('No authenticator app found', 'Enter the setup key by hand instead.'))} />
          <View style={{ padding: 16, gap: 6 }}>
            <Label secondary style={{ fontSize: 13 }}>Or enter this setup key by hand (press and hold to copy)</Label>
            <Text selectable style={{ fontSize: 15, lineHeight: 22, color: t.text, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: 0.5 }}>{enrollment.secret}</Text>
          </View>
        </Section>
      )}

      {showCodeEntry && (!enrolling || enrollment) && (
        <>
          <Section title="6-digit code">
            <TextInput accessibilityLabel="6-digit code" value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.secondaryText}
              style={[fieldStyle, { color: t.text, fontVariant: ['tabular-nums'], letterSpacing: 2 }]} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
          </Section>
          <Button title="Verify" disabled={busy || code.length < 6}
            onPress={() => run(() => auth.verifyAuthenticatorCode(code, enrollment?.factorId), 'That code didn’t work')} />
        </>
      )}
    </Screen>
  );
}
