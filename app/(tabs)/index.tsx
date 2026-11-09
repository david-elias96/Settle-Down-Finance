import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { InsightsCard } from '@/components/Insights';
import { SpendingTrend } from '@/components/SpendingTrend';
import { Label, ProgressBar, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents } from '@/src/domain';

export default function BudgetScreen() {
  const { statuses, impact, trend, forecast, month, insights } = useBudget();
  const t = useTheme();
  const totalLimit = statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);

  return (
    <Screen>
      <Section title="Spending trend">
        <View style={{ padding: 16 }}>
          <SpendingTrend trend={trend} forecast={forecast} month={month} />
        </View>
      </Section>

      <InsightsCard insights={insights} />

      <Section title="This month">
        <Row title={`${formatCents(totalSpent, { showCents: false })} of ${formatCents(totalLimit, { showCents: false })}`}
          subtitle={impact.hitsSavings > 0 ? `Overspending is taking ${formatCents(impact.hitsSavings)} from savings` : 'On track'} last>
          <ProgressBar ratio={totalSpent / totalLimit} />
        </Row>
      </Section>

      <Section title="Buckets">
        {statuses.map((s, i) => (
          <Link key={s.bucket.id} href={{ pathname: '/bucket/[id]', params: { id: s.bucket.id } }} asChild><Pressable>
          <Row icon={{ ios: s.bucket.icon as any, android: 'category', web: 'category' }} title={s.bucket.name}
            subtitle={`${formatCents(s.spent, { showCents: false })} of ${formatCents(s.bucket.monthlyLimit, { showCents: false })}`}
            right={<Label style={{ color: s.overBy > 0 ? t.red : t.secondaryText, fontVariant: ['tabular-nums'] }}>
              {s.overBy > 0 ? `${formatCents(s.overBy, { showCents: false })} over` : `${formatCents(s.remaining, { showCents: false })} left`}
            </Label>}
            last={i === statuses.length - 1}>
            <ProgressBar ratio={s.ratio} />
          </Row>
          </Pressable></Link>
        ))}
      </Section>

      <Link href="/new-bucket" asChild>
        <Pressable><Label style={{ color: t.tint, fontSize: 17, textAlign: 'center' }}>Add custom bucket</Label></Pressable>
      </Link>
    </Screen>
  );
}
