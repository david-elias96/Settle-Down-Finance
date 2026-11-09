import * as Notifications from 'expo-notifications';
import { Alert, Pressable } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { transactionNotification } from '@/src/domain';

export default function SettingsScreen() {
  const { transactions, allocations, statuses } = useBudget();
  const t = useTheme();

  // Preview of the push the backend will send when Plaid reports a new transaction.
  async function sendPreview() {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return Alert.alert('Notifications are off', 'Enable them in iOS Settings to get transaction alerts.');
    const tx = transactions[transactions.length - 1];
    const parts = allocations.filter((a) => a.transactionId === tx.id)
      .map((a) => ({ amount: a.amount, status: statuses.find((s) => s.bucket.id === a.bucketId)! }));
    const content = transactionNotification(tx, parts);
    await Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 } });
  }

  return (
    <Screen>
      <Section title="Accounts" footer="Bank linking through Plaid arrives once the backend is set up. The app is showing sample data for now.">
        <Row icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }} title="Link a bank account" subtitle="Coming soon" last />
      </Section>
      <Section title="Notifications" footer="Lock your phone after tapping to see the alert in 3 seconds.">
        <Pressable onPress={sendPreview}>
          <Row icon={{ ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' }} title="Send a sample transaction alert" right={<Label style={{ color: t.tint }}>Send</Label>} last />
        </Pressable>
      </Section>
    </Screen>
  );
}
