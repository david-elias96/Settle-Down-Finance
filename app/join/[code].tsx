import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { Button, fieldStyle, Intro, Screen, Section, useTheme } from '@/components/ui';

/**
 * Opened from an invite link (settledown://join/CODE or settledownfinancial.com/join/CODE).
 * With the backend this signs the person in, then calls `accept_invite(code, name)`.
 */
export default function JoinScreen() {
  const t = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [name, setName] = useState('');

  const join = () => {
    Alert.alert('Preview', 'Joining a household turns on once sign-in is connected. Next you would link your own bank accounts.');
    router.replace('/settings');
  };

  return (
    <Screen>
      <Intro title="Join a household">
        You've been invited to share a budget. You'll see the same buckets and goals, and can link your own bank accounts next.
      </Intro>
      <Section title={`Invite ${String(code ?? '').toUpperCase()}`}>
        <TextInput accessibilityLabel="Your first name" value={name} onChangeText={setName} placeholder="Your first name" placeholderTextColor={t.secondaryText}
          style={[fieldStyle, { color: t.text }]} autoCapitalize="words" returnKeyType="done" />
      </Section>
      <Button title="Join household" disabled={!name.trim()} onPress={join} />
    </Screen>
  );
}
