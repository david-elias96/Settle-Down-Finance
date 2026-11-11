import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Display, Intro, Label, Screen, Section } from '@/components/ui';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Preview-only code. With the backend, the code comes from the `create_invite` database function. */
const previewCode = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export default function InviteScreen() {
  const [code] = useState(previewCode);
  const link = `https://settledownfinancial.com/join/${code}`;
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;

  const share = () => Share.share({
    message: `Join our household budget on Settle Down. Install the app, then open this link: ${link} (or enter code ${pretty}).`,
  });

  return (
    <Screen>
      <Intro title="Invite a family member">
        They'll see the same buckets, goals and alerts as you. After joining, they link their own bank accounts from their own phone,
        and their purchases count toward the shared budget.
      </Intro>
      <Section title="Invite code" footer="Works once and expires in 7 days. Preview: invites start working once sign-in is connected.">
        <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 6 }}>
          <Display size={36} style={{ letterSpacing: 2 }}>{pretty}</Display>
          <Label secondary style={{ fontSize: 13 }}>{link}</Label>
        </View>
      </Section>
      <Button title="Send invite" icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} onPress={share} />
    </Screen>
  );
}
