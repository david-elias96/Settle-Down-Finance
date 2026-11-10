import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';

/**
 * Two-step verification with an authenticator app (Supabase MFA, TOTP). Required before a bank
 * can be linked (policy section 4). With `setup=1` it enrolls a new authenticator; otherwise it
 * asks for a code to step this session up.
 */
export default function TwoStepScreen() {
  const t = useTheme();
  const auth = useAuth();
  const { setup, then } = useLocalSearchParams<{ setup?: string; then?: string }>();
  const [enrollment, setEnrollment] = useState<{ factorId: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const enrolling = setup === '1' || !auth.hasFactor;

  useEffect(() => {
    if (enrolling && auth.session && !enrollment) {
      auth.startAuthenticatorSetup().then(setEnrollment).catch((e) => Alert.alert('Could not start setup', (e as Error).message));
    }
  }, [enrolling, auth.session]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async () => {
    setBusy(true);
    try {
      await auth.verifyAuthenticatorCode(code, enrollment?.factorId);
      if (then === 'connect-bank') router.replace('/connect-bank'); else router.back();
    } catch (e) {
      Alert.alert("That code didn't work", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>{enrolling ? 'Set up two-step verification' : 'Enter your code'}</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          {enrolling
            ? 'Bank connections need a second step after sign-in. Add Settle Down to an authenticator app (iPhone Passwords, Google Authenticator, 1Password), then enter the 6-digit code it shows.'
            : 'Open your authenticator app and enter the 6-digit code for Settle Down.'}
        </Label>
      </View>
      {enrolling && enrollment && (
        <Section title="Authenticator">
          <Pressable onPress={() => Linking.openURL(enrollment.uri).catch(() => Alert.alert('No authenticator app found', 'Copy the setup key instead.'))} accessibilityRole="button">
            <Row icon={{ ios: 'key.fill', android: 'key', web: 'key' }} title="Add to authenticator app" right={<Label style={{ color: t.tint }}>Open</Label>} />
          </Pressable>
          <View style={{ padding: 14, gap: 4 }}>
            <Label secondary style={{ fontSize: 13 }}>Or enter this setup key by hand (press and hold to copy)</Label>
            <Text selectable style={{ fontSize: 15, color: t.text, fontFamily: 'SpaceMono' }}>{enrollment.secret}</Text>
          </View>
        </Section>
      )}
      <Section>
        <TextInput accessibilityLabel="6-digit code" value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor={t.secondaryText}
          style={{ padding: 14, fontSize: 17, color: t.text }} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
      </Section>
      <Pressable onPress={verify} disabled={busy || code.length < 6} accessibilityRole="button"
        style={[styles.button, { backgroundColor: code.length === 6 ? t.tint : t.track }]}>
        <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Verify</Label>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
});
