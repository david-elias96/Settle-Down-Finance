import * as Notifications from 'expo-notifications';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { Label, Pill, Row, Screen, Section } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { backend, callFunction, PRIVACY_POLICY_URL } from '@/src/lib/backend';
import { useBudget } from '@/src/data/BudgetStore';
import { creditsResetLabel, daysInMonth, PLANS, transactionNotification } from '@/src/domain';
import { TRANSACTION_CATEGORY } from '@/src/notifications';

export default function SettingsScreen() {
  const { transactions, allocations, statuses, month, credits, creditBalance, members, accounts, meId } = useBudget();
  const auth = useAuth();

  // Banks linked to the household (display fields only; tokens never reach the phone).
  type LinkedBank = { id: string; institution_name: string | null; status: string; linked_by: string | null };
  const [banks, setBanks] = useState<LinkedBank[]>([]);
  const loadBanks = useCallback(async () => {
    if (!backend || !auth.householdId) return setBanks([]);
    const { data } = await backend.from('linked_institutions').select('id, institution_name, status, linked_by').eq('household_id', auth.householdId);
    setBanks(data ?? []);
  }, [auth.householdId]);
  useEffect(() => { loadBanks(); }, [loadBanks]);

  const unlink = (bank: LinkedBank) => Alert.alert(`Unlink ${bank.institution_name ?? 'this bank'}?`,
    'Settle Down will stop receiving its transactions, end its access at Plaid, and delete its accounts and transactions from your budget.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: async () => {
        try { await callFunction('plaid-unlink', { householdId: auth.householdId, itemId: bank.id }); await loadBanks(); }
        catch (e) { Alert.alert('Could not unlink', (e as Error).message); }
      } },
    ]);

  const deleteAccount = () => {
    if (!auth.session) return Alert.alert('Preview', 'Account deletion turns on once sign-in is connected.');
    Alert.alert('Delete your account?',
      'This removes your linked banks at Plaid and permanently deletes your data. Shared household data stays for the other members. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await callFunction('delete-account', { confirm: 'DELETE' }); await auth.signOut(); Alert.alert('Account deleted', 'Your data has been deleted.'); }
          catch (e) { Alert.alert('Could not delete account', (e as Error).message); }
        } },
      ]);
  };

  // Preview of the push the backend will send when Plaid reports a new transaction.
  async function sendPreview() {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return Alert.alert('Notifications are off', 'Enable them in iOS Settings to get transaction alerts.');
    // The most recent purchase this month.
    const tx = [...transactions].filter((t) => t.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))[0];
    const parts = allocations.filter((a) => a.transactionId === tx.id)
      .map((a) => ({ amount: a.amount, status: statuses.find((s) => s.bucket.id === a.bucketId)! }));
    const now = new Date();
    const { title, body, bucketId } = transactionNotification(tx, parts, now.getDate(), daysInMonth(month));
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { bucketId, transactionId: tx.id }, categoryIdentifier: TRANSACTION_CATEGORY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
  }

  return (
    <Screen>
      <Section title="Household" footer="Everyone shares buckets, goals and alerts.">
        {members.map((m) => (
          <Row key={m.id} icon={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
            title={m.id !== meId ? m.name : m.name === 'You' ? 'You' : `${m.name} (you)`}
            subtitle={(() => { const n = accounts.filter((a) => a.ownerId === m.id).length; return `${m.role === 'owner' ? 'Owner' : 'Member'} · ${n} linked account${n === 1 ? '' : 's'}`; })()} />
        ))}
        <Link href="/invite" asChild>
          <Pressable accessibilityRole="button">
            <Row icon={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }} title="Invite a family member"
              right={<Pill>Invite</Pill>} last />
          </Pressable>
        </Link>
      </Section>
      <Section title="Linked accounts" footer="Each person links their own banks from their own phone.">
        {accounts.map((a) => {
          const owner = members.find((m) => m.id === a.ownerId);
          return (
            <Row key={a.id} icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}
              title={`${a.institution} ${a.name}`} subtitle={`··${a.mask} · ${a.ownerId === meId ? 'You' : owner?.name ?? 'Family'}`} />
          );
        })}
        {banks.map((b) => (
          <Pressable key={b.id} onPress={() => (b.linked_by === auth.session?.user.id ? unlink(b) : Alert.alert('Linked by someone else', 'Only the person who linked this bank can unlink it.'))} accessibilityRole="button">
            <Row icon={{ ios: 'building.columns', android: 'account_balance', web: 'account_balance' }} title={b.institution_name ?? 'Bank'}
              subtitle={b.status === 'ok' ? 'Connected' : 'Needs reconnecting'} right={b.linked_by === auth.session?.user.id ? <Pill>Unlink</Pill> : undefined} />
          </Pressable>
        ))}
        <Pressable onPress={() => router.push('/connect-bank')} accessibilityRole="button">
          <Row icon={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} title="Link a bank account"
            subtitle={auth.connected ? 'Through Plaid, after two-step verification' : 'Turns on once sign-in is connected'} last />
        </Pressable>
      </Section>
      <Section title="Account and privacy" footer="Deleting your account removes your banks at Plaid and deletes your data within 30 days.">
        {auth.session ? (
          <>
            <Row icon={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} title={auth.email ?? 'Signed in'} subtitle="Signed in" />
            <Pressable onPress={() => router.push(auth.hasFactor ? '/two-step' : '/two-step?setup=1')} accessibilityRole="button">
              <Row icon={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }} title="Two-step verification"
                right={<Label secondary>{auth.hasPasskey ? 'Passkey' : auth.hasFactor ? 'Authenticator app' : 'Set up'}</Label>} />
            </Pressable>
            {auth.hasFactor && !auth.hasPasskey && (
              <Pressable onPress={() => router.push('/two-step?setup=passkey')} accessibilityRole="button">
                <Row icon={{ ios: 'person.badge.key.fill', android: 'key', web: 'key' }} title="Add a passkey"
                  subtitle="Face ID sign-in check that can't be phished" right={<Pill>Add</Pill>} />
              </Pressable>
            )}
          </>
        ) : auth.connected ? (
          <Pressable onPress={() => router.push('/sign-in')} accessibilityRole="button">
            <Row icon={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} title="Sign in" right={<Pill>Sign in</Pill>} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} accessibilityRole="link">
          <Row icon={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} title="Privacy policy" right={<Pill>Read</Pill>} />
        </Pressable>
        {auth.session && (
          <Pressable onPress={() => auth.signOut()} accessibilityRole="button">
            <Row icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} title="Sign out" />
          </Pressable>
        )}
        <Pressable onPress={deleteAccount} accessibilityRole="button">
          <Row icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} title="Delete my account" right={<Pill tone="bad">Delete</Pill>} last />
        </Pressable>
      </Section>
      <Section title="Plan" footer={`Ask and receipt scans use 1 credit each. Resets ${creditsResetLabel(month)}.`}>
        <Row icon={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }} title="Settle Down" subtitle={`${PLANS.monthly.price} or ${PLANS.yearly.price}`} />
        <Row icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} title="AI credits"
          right={<Label secondary>{creditBalance.monthly} of {credits.allowance}{creditBalance.extra ? ` + ${creditBalance.extra}` : ''}</Label>} last />
      </Section>
      {Platform.OS === 'web' ? (
        <Section title="Notifications" footer="Purchase alerts on the home-screen web app come in a later update. Until then, new purchases show up in Activity.">
          <Row icon={{ ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' }} title="Transaction alerts" subtitle="Coming to the web app" last />
        </Section>
      ) : (
        <Section title="Notifications" footer="Lock your phone after tapping Send. The alert arrives in 3 seconds.">
          <Pressable onPress={sendPreview} accessibilityRole="button">
            <Row icon={{ ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' }} title="Send a sample transaction alert" right={<Pill>Send</Pill>} last />
          </Pressable>
        </Section>
      )}
    </Screen>
  );
}
