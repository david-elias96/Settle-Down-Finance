import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Platform, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import QRCode from 'react-native-qrcode-svg';
import { Button, fieldStyle, IconChip, Intro, KeyboardDone, Label, ListRow, Screen, Section, useTheme } from '@/components/ui';
import { AppIcon, useAuthenticatorIcons } from '@/components/AppIcon';
import { useAuth } from '@/src/auth/AuthProvider';
import { AUTHENTICATOR_APPS, openAuthenticator } from '@/src/lib/authenticators';

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
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const icons = useAuthenticatorIcons();

  const copyKey = async () => {
    if (!enrollment) return;
    await Clipboard.setStringAsync(enrollment.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
    <Screen overlay={<KeyboardDone />}>
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
        <>
          <Section title="Choose your authenticator app" footer="Tapping an app copies your setup key and opens it, or opens the App Store if you don't have it yet. In the app, add an account, choose to enter a setup key, and paste.">
            {AUTHENTICATOR_APPS.map((app) => (
              <ListRow key={app.name} title={app.name} leading={<AppIcon uri={icons[app.appStoreId]} />}
                onPress={async () => { await copyKey(); await openAuthenticator(app, Platform.OS, Linking).catch(() => Alert.alert(`Could not open ${app.name}`, 'Your setup key is copied. Open your authenticator app and paste it.')); }} />
            ))}
            {Platform.OS === 'ios' && (
              <ListRow title="Apple Passwords" last leading={<PasswordsIcon />}
                onPress={() => Linking.openURL(enrollment.uri).catch(() => Alert.alert('Could not open Passwords', 'Copy the setup key below instead.'))} />
            )}
          </Section>
          <Section title="Or add it by hand">
            <View style={{ padding: 16, gap: 10 }}>
              <Label secondary style={{ fontSize: 14, lineHeight: 20 }}>Your setup key. Name the account Settle Down.</Label>
              <Text selectable accessibilityLabel={`Setup key ${enrollment.secret.split('').join(' ')}`}
                style={{ fontSize: 17, lineHeight: 26, color: t.text, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: 1 }}>
                {groupKey(enrollment.secret)}
              </Text>
              <Button variant="secondary" title={copied ? 'Copied' : 'Copy setup key'} icon={{ ios: copied ? 'checkmark' : 'doc.on.doc', android: 'content_copy', web: 'content_copy' }}
                onPress={copyKey} />
            </View>
            <ListRow title={showQr ? 'Hide QR code' : 'Show QR code'} note="Scan it from another phone or tablet" last={!showQr} chevron={false}
              leading={<IconChip icon={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }} />} onPress={() => setShowQr((v) => !v)} />
            {showQr && (
              <View style={{ alignItems: 'center', padding: 16 }} accessible accessibilityLabel="QR code for your authenticator app">
                <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12 }}>
                  <QRCode value={enrollment.uri} size={180} color="#17221D" backgroundColor="#FFFFFF" />
                </View>
              </View>
            )}
          </Section>
        </>
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

/** "JBSW Y3DP EHPK 3PXP": a setup key in groups of four, easier to read and check. */
function groupKey(secret: string) {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** Stand-in for the Passwords app icon (a system app, so it has no App Store icon to load). */
function PasswordsIcon() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={{ ios: 'key.fill', android: 'key', web: 'key' }} size={22} tintColor="#FFFFFF" />
    </View>
  );
}
