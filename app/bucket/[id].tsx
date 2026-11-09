import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BucketGauge, PaceBadge } from '@/components/BucketGauge';
import { Label, ProgressBar, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { bucketPace, daysInMonth, formatCents } from '@/src/domain';

/** Where the family stands in one bucket this month. Opened from a transaction alert or the Budget tab. */
export default function BucketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, transactions, allocations, month } = useBudget();
  const t = useTheme();
  const status = statuses.find((s) => s.bucket.id === id);
  if (!status) {
    return <Screen><Label secondary>This bucket no longer exists.</Label></Screen>;
  }

  const days = daysInMonth(month);
  const today = new Date().getDate();
  const pace = bucketPace(status, today, days);
  const monthTx = transactions.filter((tx) => tx.date.startsWith(month));
  const items = allocations
    .filter((a) => a.bucketId === id)
    .map((a) => ({ a, tx: monthTx.find((tx) => tx.id === a.transactionId) }))
    .filter((x) => x.tx)
    .sort((x, y) => y.tx!.date.localeCompare(x.tx!.date));

  return (
    <Screen>
      <Stack.Screen options={{ title: status.bucket.name }} />
      <View style={{ gap: 14, paddingTop: 8 }}>
        <BucketGauge status={status} pace={pace} />
        <PaceBadge pace={pace} />
        <Label secondary style={{ textAlign: 'center', fontSize: 15, paddingHorizontal: 16 }}>{pace.detail}</Label>
      </View>

      <Section footer="The black tick on the ring marks an even pace for today. Filling past it means this bucket is being spent faster than planned.">
        <Row title="Spent" right={<Label>{formatCents(status.spent)}</Label>} />
        <Row title={status.overBy > 0 ? 'Over by' : 'Left'}
          right={<Label style={{ color: status.overBy > 0 ? t.red : t.text }}>{formatCents(status.overBy > 0 ? status.overBy : status.remaining)}</Label>} />
        <Row title={`Even pace by day ${today}`} right={<Label>{formatCents(pace.expectedByToday)}</Label>} />
        <Row title="At this rate, month ends at" right={<Label>{formatCents(pace.projectedTotal, { showCents: false })}</Label>} last>
          <ProgressBar ratio={pace.projectedTotal / Math.max(1, status.bucket.monthlyLimit)} />
        </Row>
      </Section>

      <Section title="This month">
        {items.length === 0 && <Row title="No spending yet" last />}
        {items.map(({ a, tx }, i) => (
          <Row key={`${a.transactionId}`} title={tx!.merchant}
            subtitle={`${tx!.date.slice(5)}${tx!.pending ? ' · Pending' : ''}${a.amount !== tx!.amount ? ` · split from ${formatCents(tx!.amount)}` : ''}`}
            right={<Label style={{ fontVariant: ['tabular-nums'] }}>{formatCents(a.amount)}</Label>} last={i === items.length - 1} />
        ))}
      </Section>
    </Screen>
  );
}
