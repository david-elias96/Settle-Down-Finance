import * as Notifications from 'expo-notifications';
import { Link } from 'expo-router';
import { Alert, Pressable } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { CREDIT_PACK, creditsResetLabel, daysInMonth, PLANS, transactionNotification } from '@/src/domain';
import { TRANSACTION_CATEGORY } from '@/src/notifications';

export default function SettingsScreen() {
  const { transactions, allocations, statuses, month, credits, creditBalance, members, accounts, meId } = useBudget();
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
      <Section title="Household" footer="Everyone in the household shares the same buckets and goals, and everyone gets the transaction alerts.">
        {members.map((m) => (
          <Row key={m.id} icon={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
            title={m.id !== meId ? m.name : m.name === 'You' ? 'You' : `${m.name} (you)`}
            subtitle={(() => { const n = accounts.filter((a) => a.ownerId === m.id).length; return `${m.role === 'owner' ? 'Owner' : 'Member'} · ${n} linked account${n === 1 ? '' : 's'}`; })()} />
        ))}
        <Link href="/invite" asChild>
          <Pressable accessibilityRole="button">
            <Row icon={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }} title="Invite a family member"
              right={<Label style={{ color: t.tint }}>Invite</Label>} last />
          </Pressable>
        </Link>
      </Section>
      <Section title="Linked accounts" footer="Each person links their own banks from their own phone, so nobody shares a bank password. Bank linking through Plaid turns on with the first TestFlight build; the app shows sample data for now.">
        {accounts.map((a) => {
          const owner = members.find((m) => m.id === a.ownerId);
          return (
            <Row key={a.id} icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}
              title={`${a.institution} ${a.name}`} subtitle={`··${a.mask} · ${a.ownerId === meId ? 'You' : owner?.name ?? 'Family'}`} />
          );
        })}
        <Row icon={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} title="Link a bank account" subtitle="Coming with the TestFlight build" last />
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
