import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AiMark, Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { cancelRoute, findSubscriptions, formatCents, shortDate } from '@/src/domain';

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
      <Section title={`${subs.length} subscriptions`} footer="AI cancels for you. You sign in yourself and approve the last step.">
        {subs.length === 0 && <Row title="None found yet" subtitle="They appear after two months of charges." last />}
        {subs.map((s, i) => {
          const route = cancelRoute(s.vendor);
          const up = s.amount > s.previousAmount;
          return (
            <Row key={s.vendor} title={s.vendor} last={i === subs.length - 1}
              subtitle={`${formatCents(s.amount)}/mo · ${up ? `up ${formatCents(s.amount - s.previousAmount)} · ` : ''}${shortDate(s.lastDate)}`}
              right={
                <Pressable accessibilityRole="button" accessibilityLabel={route?.via === 'apple' ? `Manage ${s.vendor} in Apple settings` : `Cancel ${s.vendor} with AI`}
                  onPress={() => router.push({ pathname: '/cancel', params: { vendor: s.vendor, amount: String(s.amount) } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: t.track }}>
                  {route?.via !== 'apple' && <AiMark size={12} color={t.redText} />}
                  <Label style={{ color: t.redText, fontSize: 14, fontWeight: '600' }}>{route?.via === 'apple' ? 'Manage' : 'Cancel'}</Label>
                </Pressable>
              } />
          );
        })}
      </Section>
      <Section footer="A pretend service. Free, nothing real is touched.">
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/cancel', params: { demo: '1' } })}>
          <Row icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} title="Try it on a practice site" right={<Label style={{ color: t.tint }}>Start</Label>} last />
        </Pressable>
      </Section>
    </Screen>
  );
}
