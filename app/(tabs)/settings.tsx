import * as Notifications from 'expo-notifications';
import { Alert, Pressable } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { CREDIT_PACK, creditsResetLabel, daysInMonth, PLANS, transactionNotification } from '@/src/domain';
import { TRANSACTION_CATEGORY } from '@/src/notifications';

export default function SettingsScreen() {
  const { transactions, allocations, statuses, month, credits, creditBalance } = useBudget();
  const t = useTheme();

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
      <Section title="Accounts" footer="Bank linking through Plaid arrives once the backend is set up. The app is showing sample data for now.">
        <Row icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }} title="Link a bank account" subtitle="Coming soon" last />
      </Section>
      <Section title="Plan" footer={`Each Ask question or receipt scan uses 1 credit. Daily insights and the weekly summary are free. Monthly credits reset ${creditsResetLabel(month)}; extra packs (${CREDIT_PACK.credits} for ${CREDIT_PACK.price}) never expire.`}>
        <Row icon={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }} title="Settle Down" subtitle={`${PLANS.monthly.price} or ${PLANS.yearly.price}`} />
        <Row icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} title="AI credits"
          right={<Label secondary>{creditBalance.monthly} of {credits.allowance}{creditBalance.extra ? ` + ${creditBalance.extra}` : ''}</Label>} last />
      </Section>
      <Section title="Notifications" footer="Lock your phone after tapping Send. In 3 seconds the alert appears: press and hold it to see the bucket, or tap it to open the bucket in the app.">
        <Pressable onPress={sendPreview}>
          <Row icon={{ ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' }} title="Send a sample transaction alert" right={<Label style={{ color: t.tint }}>Send</Label>} last />
        </Pressable>
      </Section>
    </Screen>
  );
}
