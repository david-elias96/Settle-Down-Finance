import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { callFunction, PLAID_PRIVACY_URL, PRIVACY_POLICY_URL } from '@/src/lib/backend';

/**
 * Link a bank. Shows the data-use notice and records consent, then opens Plaid Link. The
 * backend refuses a Link token unless the user is signed in with two-step verification (AAL2)
 * and accepted this notice version (policy sections 4 and 8); this screen just routes there.
 */
export default function ConnectBankScreen() {
  const t = useTheme();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);

  // Send the user to the step they're missing: sign in, then two-step verification.
  useEffect(() => {
    if (!auth.connected || !auth.ready) return;
    if (auth.linkGate.ok || auth.linkGate.next === 'consent') return;
    if (auth.linkGate.next === 'sign_in') router.replace('/sign-in');
    else router.replace(auth.hasFactor ? '/two-step?then=connect-bank' : '/two-step?setup=1&then=connect-bank');
  }, [auth.connected, auth.ready, auth.linkGate, auth.hasFactor]);

  const agreeAndConnect = async () => {
    setBusy(true);
    try {
      if (!auth.linkGate.ok) await auth.acceptConsent();
      const householdId = await auth.ensureHousehold();
      const { linkToken } = await callFunction<{ linkToken: string }>('plaid-link-token', { householdId });
      // Loaded lazily: Plaid's native SDK exists only in development and TestFlight builds.
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: async (success) => {
          try {
            const r = await callFunction<{ accounts: number }>('plaid-exchange', {
              householdId, publicToken: success.publicToken, institutionName: success.metadata.institution?.name ?? null,
            });
            Alert.alert('Bank connected', `${r.accounts} account${r.accounts === 1 ? '' : 's'} linked. New purchases will show up shortly.`);
            router.back();
          } catch (e) {
            Alert.alert('Could not finish connecting', (e as Error).message);
          }
        },
        onExit: () => setBusy(false),
        onEvent: () => {},
      });
      await session.open();
    } catch (e) {
      Alert.alert('Could not open bank connection', (e as Error).message);
      setBusy(false);
    }
  };

  if (!auth.connected) {
    return (
      <Screen>
        <Label secondary style={{ paddingHorizontal: 4 }}>Linking banks turns on with the TestFlight build, once sign-in is connected.</Label>
      </Screen>
    );
  }
  if (!auth.ready || (!auth.linkGate.ok && auth.linkGate.next !== 'consent')) {
    return <Screen><ActivityIndicator /></Screen>;
  }

  return (
    <Screen>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 22, fontWeight: '700' }}>Connect your bank</Label>
        <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>
          Settle Down uses Plaid to connect to your bank. You sign in to your bank inside Plaid; we never see your bank username or password.
        </Label>
      </View>
      <Section title="What we collect and why">
        <Row icon={{ ios: 'list.bullet.rectangle', android: 'list', web: 'list' }} title="Accounts, balances and transactions"
          subtitle="Account names, the last 4 digits, balances, and the last 90 days of transactions, then new ones as they post." />
        <Row icon={{ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }} title="Used only for your budget"
          subtitle="Sorting purchases into buckets, alerts, insights and AI answers for you and your household." />
        <Row icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }} title="Shared with your household"
          subtitle="Members of your household see these transactions in the shared budget." />
        <Row icon={{ ios: 'hand.raised.fill', android: 'block', web: 'block' }} title="Never sold"
          subtitle="We don't sell your data or use it for ads. Our service providers (Plaid, Supabase, Anthropic, Expo, Apple) process it only to run the app." />
        <Row icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} title="You stay in control" last
          subtitle="Unlink a bank or delete your account in Settings at any time; we delete the data and end our access at Plaid." />
      </Section>
      <Section>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} accessibilityRole="link">
          <Row icon={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} title="Settle Down Privacy Policy" right={<Label style={{ color: t.tint }}>Read</Label>} />
        </Pressable>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PLAID_PRIVACY_URL)} accessibilityRole="link">
          <Row icon={{ ios: 'doc.text', android: 'description', web: 'description' }} title="Plaid End User Privacy Policy" right={<Label style={{ color: t.tint }}>Read</Label>} last />
        </Pressable>
      </Section>
      <Pressable onPress={agreeAndConnect} disabled={busy} accessibilityRole="button" style={[styles.button, { backgroundColor: busy ? t.track : t.tint }]}>
        <Label style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>{auth.linkGate.ok ? 'Continue to Plaid' : 'Agree and continue'}</Label>
      </Pressable>
      <Label secondary style={{ fontSize: 13, paddingHorizontal: 20, textAlign: 'center' }}>
        By continuing you agree to the Privacy Policy and allow Settle Down to collect, store and use this data as described.
      </Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { marginHorizontal: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
});
