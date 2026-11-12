import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Alert, Share, View } from 'react-native';
import { Button, Display, Intro, Label, Notice, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { authErrorMessage } from '@/src/auth/flow';
import { WEB_APP_ORIGIN } from '@/src/lib/backend';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Development previews only (no backend): a made-up code that joins nothing. */
const previewCode = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/**
 * Invite a family member. Signed in, the code comes from `create_invite` (single use, 7 days)
 * and the link opens the web app's join page, where they sign in and join this household.
 */
export default function InviteScreen() {
  const t = useTheme();
  const auth = useAuth();
  const [code, setCode] = useState<string | null>(auth.connected ? null : previewCode());
  const [error, setError] = useState<string | null>(null);

  const make = () => {
    setError(null);
    auth.createInvite().then(setCode).catch((e) => setError(authErrorMessage(e) ?? 'Please try again.'));
  };
  useEffect(() => { if (auth.connected) make(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const link = code ? `${WEB_APP_ORIGIN}/join/${code}` : '';
  const pretty = code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
  const message = `Join our household budget on Settle Down: ${link} (invite code ${pretty}). It works once and expires in 7 days.`;
  // Desktop browsers often have no share sheet: copy the invite instead.
  const share = () => Share.share({ message }).catch(async () => {
    await Clipboard.setStringAsync(message);
    Alert.alert('Invite copied', 'Paste it into a text or email to the person you’re inviting.');
  });

  return (
    <Screen>
      <Intro title="Invite a family member">
        They'll see the same buckets, goals and alerts as you. After joining, they link their own bank accounts,
        and their purchases count toward the shared budget.
      </Intro>
      {error ? (
        <>
          <Notice title="Couldn't make an invite">{error}</Notice>
          <Button title="Try again" onPress={make} />
        </>
      ) : (
        <>
          <Section title="Invite code" footer={auth.connected ? 'Works once and expires in 7 days.' : 'Sample code: invites work once the app is connected to the backend.'}>
            <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 6 }}>
              {code ? (
                <>
                  <Display size={36} style={{ letterSpacing: 2 }}>{pretty}</Display>
                  <Label secondary style={{ fontSize: 13 }}>{link}</Label>
                </>
              ) : <ActivityIndicator color={t.tint} />}
            </View>
          </Section>
          <Button title="Send invite" disabled={!code} icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} onPress={share} />
        </>
      )}
    </Screen>
  );
}
