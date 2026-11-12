import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, View } from 'react-native';
import { Button, Card, IconChip, Intro, Label, Notice, Pill, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useBudget } from '@/src/data/BudgetStore';
import { callFunction, PLAID_PRIVACY_URL, PRIVACY_POLICY_URL } from '@/src/lib/backend';
import { openPlaidLink, pendingOAuthReturn, type PlaidLinkResult } from '@/src/lib/plaidLink';

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
  /** Shown under the button while it works, so tapping Agree visibly does something. */
  const [status, setStatus] = useState<string | null>(null);

  // Send the user to the step they're missing: sign in, then two-step verification.
  useEffect(() => {
    if (!auth.connected || !auth.ready) return;
    if (auth.linkGate.ok || auth.linkGate.next === 'consent') return;
    if (auth.linkGate.next === 'sign_in') router.replace('/sign-in');
    else router.replace('/two-step?then=connect-bank');
  }, [auth.connected, auth.ready, auth.linkGate, auth.hasFactor]);

  /** Sends Plaid's one-time public token to the backend, which keeps the access token in Vault. */
  const finishLink = async (householdId: string, result: PlaidLinkResult) => {
    if (!result) { setBusy(false); setStatus(null); return; }
    setStatus('Finishing up…');
    try {
      const r = await callFunction<{ accounts: number }>('plaid-exchange', {
        householdId, publicToken: result.publicToken, institutionName: result.institutionName,
      });
      reload();
      Alert.alert('Bank connected', `${r.accounts} account${r.accounts === 1 ? '' : 's'} linked. New purchases will show up shortly.`);
      if (router.canGoBack()) router.back(); else router.replace('/settings');
    } catch (e) {
      Alert.alert('Could not finish connecting', (e as Error).message);
      setBusy(false);
      setStatus(null);
    }
  };

  // Web app: coming back from a bank's own sign-in page (OAuth) resumes the same Link session.
  useEffect(() => {
    if (Platform.OS !== 'web' || !auth.ready || !auth.linkGate.ok) return;
    const resume = pendingOAuthReturn();
    if (!resume) return;
    setBusy(true);
    setStatus('Finishing your bank sign-in…');
    openPlaidLink({ ...resume, receivedRedirectUri: window.location.href })
      .then((result) => finishLink(resume.householdId, result))
      .catch((e) => { Alert.alert('Could not open bank connection', (e as Error).message); setBusy(false); setStatus(null); });
  }, [auth.ready, auth.linkGate.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const agreeAndConnect = async () => {
    setBusy(true);
    try {
      if (!auth.linkGate.ok) {
        setStatus('Saving your agreement…');
        await auth.acceptConsent();
      }
      setStatus('Getting your secure bank connection ready…');
      const householdId = await auth.ensureHousehold();
      const { linkToken } = await callFunction<{ linkToken: string }>('plaid-link-token', { householdId, web: Platform.OS === 'web' });
      // Expo Go can't open Plaid (no native SDK). Getting this far still proves the backend is ready.
      if (Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        Alert.alert('Almost there', 'Your account is ready for bank linking. Plaid itself only opens in the real app build (TestFlight or a development build), not in Expo Go.');
        setBusy(false);
        setStatus(null);
        return;
      }
      setStatus('Opening Plaid…');
      await finishLink(householdId, await openPlaidLink({ token: linkToken, householdId }));
    } catch (e) {
      Alert.alert('Could not open bank connection', (e as Error).message);
      setBusy(false);
      setStatus(null);
    }
  };

  if (!auth.connected) {
    return (
      <Screen>
        <Notice title="Bank linking isn't on yet" icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}>Linking banks turns on once sign-in is connected.</Notice>
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
          {auth.linkGate.ok ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} accessible accessibilityLabel="You agreed to these terms">
              <IconChip icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tone="good" />
              <View style={{ flex: 1, gap: 2 }}>
                <Label style={{ fontSize: 16, fontWeight: '600' }}>You agreed to these terms</Label>
                <Label secondary style={{ fontSize: 13, lineHeight: 18 }}>Thanks. Next, sign in to your bank inside Plaid.</Label>
              </View>
            </View>
          ) : (
            <Label secondary style={{ fontSize: 14, lineHeight: 20 }}>
              By continuing you agree to the Privacy Policy and allow Settle Down to collect, store and use this data as described.
            </Label>
          )}
          <Button title={auth.linkGate.ok ? 'Continue to Plaid' : 'Agree and continue'} loading={busy} onPress={agreeAndConnect} />
          {status && <Label secondary style={{ fontSize: 13, textAlign: 'center' }}>{status}</Label>}
        </View>
      </Card>
    </Screen>
  );
}
