import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Label, Screen, Section, useTheme } from '@/components/ui';

/**
 * Opened from an invite link (settledown://join/CODE or settledownfinance.com/join/CODE).
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
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>Join a household</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          You've been invited to share a budget. You'll see the same buckets and goals, and can link your own bank accounts next.
        </Label>
      </View>
      <Section title={`Invite ${String(code ?? '').toUpperCase()}`}>
        <TextInput accessibilityLabel="Your first name" value={name} onChangeText={setName} placeholder="Your first name" placeholderTextColor={t.secondaryText}
          style={{ padding: 14, fontSize: 17, color: t.text }} autoCapitalize="words" returnKeyType="done" />
      </Section>
      <Pressable onPress={join} disabled={!name.trim()} accessibilityRole="button"
        style={[styles.button, { backgroundColor: name.trim() ? t.tint : t.track }]}>
        <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Join household</Label>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
});
