import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { Button, fieldStyle, Intro, Notice, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { authErrorMessage } from '@/src/auth/flow';
import { prefs } from '@/src/lib/prefs';

const PENDING_NAME = 'pending-invite-name';

/**
 * Opened from an invite link (app.settledownfinancial.com/join/CODE). Signed out, it remembers
 * the code and name and sends them to sign in; the route guard brings them back here, where
 * `accept_invite` adds them to the household. Then the "Link your banks" welcome or the app.
 */
export default function JoinScreen() {
  const t = useTheme();
  const auth = useAuth();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const valid = code.length === 8;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { prefs.get(PENDING_NAME).then((n) => { if (n) setName(n); }); }, []);

  const join = async () => {
    if (!auth.connected) {
      Alert.alert('Preview', 'Joining a household works once the app is connected to the backend.');
      return;
    }
    if (!auth.session) {
      // Sign in first; the guard returns here afterwards.
      await prefs.set(PENDING_NAME, name.trim());
      await auth.setPendingInvite(code);
      router.replace('/sign-in');
      return;
    }
    setBusy(true);
    try {
      await auth.acceptInvite(code, name);
      await prefs.remove(PENDING_NAME);
      router.replace('/');
    } catch (e) {
      Alert.alert('Couldn’t join', authErrorMessage(e) ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const notNow = async () => { await auth.setPendingInvite(null); await prefs.remove(PENDING_NAME); router.replace('/'); };

  if (!valid) {
    return (
      <Screen>
        <Notice title="This invite link isn't complete">Ask the person who invited you to send the link again.</Notice>
        <Button title="Go to Settle Down" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen keyboardDone>
      <Intro title="Join a household">
        You've been invited to share a budget. You'll see the same buckets and goals, and can link your own bank accounts next.
      </Intro>
      <Section title={`Invite ${code.slice(0, 4)}-${code.slice(4)}`} footer={auth.session ? undefined : 'Next you’ll sign in or create your account, then come back here to join.'}>
        <TextInput accessibilityLabel="Your first name" value={name} onChangeText={setName} placeholder="Your first name" placeholderTextColor={t.secondaryText}
          style={[fieldStyle, { color: t.text }]} autoCapitalize="words" autoComplete="given-name" returnKeyType="done" />
      </Section>
      <Button title={auth.session ? 'Join household' : 'Sign in to join'} loading={busy} disabled={busy || !name.trim()} onPress={join} />
      {auth.session && <Button title="Not now" variant="plain" disabled={busy} onPress={notNow} />}
    </Screen>
  );
}
