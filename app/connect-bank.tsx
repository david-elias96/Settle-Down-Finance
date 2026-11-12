import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Button, Card, Intro, Label, Notice, Pill, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useBudget } from '@/src/data/BudgetStore';
import { callFunction, PLAID_PRIVACY_URL, PRIVACY_POLICY_URL } from '@/src/lib/backend';

/**
 * Link a bank. Shows the data-use notice and records consent, then opens Plaid Link. The
 * backend refuses a Link token unless the user is signed in with two-step verification (AAL2)
 * and accepted this notice version (policy sections 4 and 8); this screen just routes there.
 */
export default function ConnectBankScreen() {
  const t = useTheme();
  const auth = useAuth();
  const { reload } = useBudget();
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
      // Expo Go can't open Plaid (no native SDK). Getting this far still proves the backend is ready.
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        Alert.alert('Almost there', 'Your account is ready for bank linking. Plaid itself only opens in the real app build (TestFlight or a development build), not in Expo Go.');
        setBusy(false);
        return;
      }
      // Loaded lazily: Plaid's native SDK exists only in development and TestFlight builds.
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: async (success) => {
          try {
            const r = await callFunction<{ accounts: number }>('plaid-exchange', {
              householdId, publicToken: success.publicToken, institutionName: success.metadata.institution?.name ?? null,
            });
            reload();
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
        <Notice title="Bank linking isn't on yet" icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}>Linking banks turns on with the TestFlight build, once sign-in is connected.</Notice>
      </Screen>
    );
  }
  if (!auth.ready || (!auth.linkGate.ok && auth.linkGate.next !== 'consent')) {
    return <Screen><ActivityIndicator color={t.tint} style={{ marginTop: 48 }} /></Screen>;
  }

  return (
    <Screen>
      <Intro title="Connect your bank">
        Settle Down uses Plaid to connect to your bank. You sign in to your bank inside Plaid; we never see your bank username or password.
      </Intro>
      <Section title="What we collect and why">
        <Row icon={{ ios: 'list.bullet.rectangle', android: 'list', web: 'list' }} title="Accounts, balances and transactions"
          subtitle="Account names, the last 4 digits, balances, and the last 90 days of transactions, then new ones as they post." />
        <Row icon={{ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }} title="Used only for your budget"
          subtitle="Sorting purchases into buckets, alerts, insights and AI answers for you and your household." />
        <Row icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }} title="Shared with your household"
          subtitle="Members of your household see these transactions in the shared budget." />
        <Row icon={{ ios: 'hand.raised.fill', android: 'block', web: 'block' }} title="Never sold"
          subtitle="We don't sell your data or use it for ads. Our service providers (Plaid, Supabase, Anthropic, Resend, Expo, Apple) process it only to run the app." />
        <Row icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} title="You stay in control" last
          subtitle="Unlink a bank or delete your account in Settings at any time; we delete the data and end our access at Plaid." />
      </Section>
      <Section>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} accessibilityRole="link">
          <Row icon={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} title="Settle Down Privacy Policy" right={<Pill>Read</Pill>} />
        </Pressable>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PLAID_PRIVACY_URL)} accessibilityRole="link">
          <Row icon={{ ios: 'doc.text', android: 'description', web: 'description' }} title="Plaid End User Privacy Policy" right={<Pill>Read</Pill>} last />
        </Pressable>
      </Section>
      <Card padded>
        <View style={{ gap: 14 }}>
          <Label secondary style={{ fontSize: 14, lineHeight: 20 }}>
            By continuing you agree to the Privacy Policy and allow Settle Down to collect, store and use this data as described.
          </Label>
          <Button title={auth.linkGate.ok ? 'Continue to Plaid' : 'Agree and continue'} loading={busy} onPress={agreeAndConnect} />
        </View>
      </Card>
    </Screen>
  );
}
