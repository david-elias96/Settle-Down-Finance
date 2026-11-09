import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Label, Screen, Section, useTheme } from '@/components/ui';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Preview-only code. With the backend, the code comes from the `create_invite` database function. */
const previewCode = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export default function InviteScreen() {
  const t = useTheme();
  const [code] = useState(previewCode);
  const link = `https://settledownfinance.com/join/${code}`;
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;

  const share = () => Share.share({
    message: `Join our household budget on Settle Down. Install the app, then open this link: ${link} (or enter code ${pretty}).`,
  });

  return (
    <Screen>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>Invite a family member</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          They'll see the same buckets, goals and alerts as you. After joining, they link their own bank accounts from their own phone,
          and their purchases count toward the shared budget.
        </Label>
      </View>
      <Section title="Invite code" footer="Works once and expires in 7 days.">
        <View style={{ padding: 16, alignItems: 'center', gap: 4 }}>
          <Label style={{ fontSize: 32, fontWeight: '700', letterSpacing: 2, fontVariant: ['tabular-nums'] }}>{pretty}</Label>
          <Label secondary style={{ fontSize: 13 }}>{link}</Label>
        </View>
      </Section>
      <Pressable onPress={share} accessibilityRole="button" style={[styles.button, { backgroundColor: t.tint }]}>
        <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Send invite</Label>
      </Pressable>
      <Label secondary style={{ fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
        Preview: invites start working once sign-in is connected.
      </Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
});
