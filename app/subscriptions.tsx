import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { cancelRoute, findSubscriptions, formatCents } from '@/src/domain';

/** Recurring charges found in the transactions, each with a way to cancel. */
export default function SubscriptionsScreen() {
  const t = useTheme();
  const { transactions } = useBudget();
  const subs = findSubscriptions(transactions);
  const total = subs.reduce((s, x) => s + x.amount, 0);

  return (
    <Screen>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Label secondary style={{ fontSize: 13 }}>Recurring charges</Label>
        <Label style={{ fontSize: 30, fontWeight: '700' }}>{formatCents(total)}<Label secondary style={{ fontSize: 17 }}> /month</Label></Label>
        <Label secondary style={{ fontSize: 13 }}>{formatCents(total * 12, { showCents: false })} a year</Label>
      </View>
      <Section title={`${subs.length} subscriptions`} footer="Found from charges that repeat each month. Claude can cancel most of them for you: you sign in yourself and approve the last step.">
        {subs.length === 0 && <Row title="None found yet" subtitle="They appear after two months of charges." last />}
        {subs.map((s, i) => {
          const route = cancelRoute(s.vendor);
          const up = s.amount > s.previousAmount;
          return (
            <Row key={s.vendor} title={s.vendor} last={i === subs.length - 1}
              subtitle={`${formatCents(s.amount)}/month${up ? ` · up from ${formatCents(s.previousAmount)}` : ''} · last charged ${s.lastDate.slice(5)}`}
              right={
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/cancel', params: { vendor: s.vendor, amount: String(s.amount) } })}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: t.track }}>
                  <Label style={{ color: t.red, fontSize: 14, fontWeight: '600' }}>{route?.via === 'apple' ? 'Manage' : 'Cancel'}</Label>
                </Pressable>
              } />
          );
        })}
      </Section>
      <Section footer="Watch Claude cancel a pretend streaming service, start to finish. Free, nothing real is touched.">
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/cancel', params: { demo: '1' } })}>
          <Row icon={{ ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' }} title="Try it on a practice site" right={<Label style={{ color: t.tint }}>Start</Label>} last />
        </Pressable>
      </Section>
    </Screen>
  );
}
