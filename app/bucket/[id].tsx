import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BucketGauge } from '@/components/BucketGauge';
import { Card, Label, ListRow, Screen, Section, StatTile, Tag } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { bucketPace, daysInMonth, formatCents, paceTag, shortDate, weeklyAllowance } from '@/src/domain';

/** Where the family stands in one bucket this month. Opened from a transaction alert or the Budget tab. */
export default function BucketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, transactions, allocations, month, today } = useBudget();
  const status = statuses.find((s) => s.bucket.id === id);
  if (!status) return <Screen><Label secondary>This bucket no longer exists.</Label></Screen>;

  const days = daysInMonth(month);
  const pace = bucketPace(status, today, days);
  const tag = paceTag(status, pace);
  const week = weeklyAllowance(status, today, days);
  const $ = (c: number) => formatCents(c, { showCents: false });
  const items = allocations
    .filter((a) => a.bucketId === id)
    .map((a) => ({ a, tx: transactions.find((tx) => tx.id === a.transactionId && tx.date.startsWith(month)) }))
    .filter((x) => x.tx)
    .sort((x, y) => y.tx!.date.localeCompare(x.tx!.date));

  return (
    <Screen>
      <Stack.Screen options={{ title: status.bucket.name }} />
      <Card>
      <View style={{ gap: 10, paddingVertical: 20, alignItems: 'center' }}>
        <BucketGauge status={status} pace={pace} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Tag tone={tag.tone}>{tag.tag}</Tag>
          {tag.tone !== 'good' && status.overBy === 0 && <Label secondary style={{ fontSize: 14 }}>Heading for {$(pace.projectedTotal)}</Label>}
        </View>
        <Label secondary style={{ fontSize: 12 }}>The tick marks an even pace for today</Label>
      </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Spent" value={$(status.spent)} />
        {status.overBy > 0
          ? <StatTile label="Over by" value={$(status.overBy)} tone="bad" />
          : <StatTile label="Left" value={$(status.remaining)} />}
        <StatTile label={week.kind === 'rest' ? `Last ${week.days} days` : 'Per week'}
          value={week.kind === 'none' ? '$0' : $(week.amount)} tone={week.kind === 'none' ? 'bad' : undefined} />
      </View>

      <Section title="This month">
        {items.length === 0 && <ListRow title="No spending yet" last />}
        {items.map(({ a, tx }, i) => (
          <ListRow key={a.transactionId} title={tx!.merchant.trim()} figure={formatCents(a.amount)} last={i === items.length - 1}
            note={[shortDate(tx!.date), tx!.pending ? 'Pending' : null, a.amount !== tx!.amount ? `share of ${formatCents(tx!.amount)}` : null].filter(Boolean).join(' · ')}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx!.id } })} />
        ))}
      </Section>
    </Screen>
  );
}
