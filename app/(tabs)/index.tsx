import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { BillsCard } from '@/components/Bills';
import { InsightsCard } from '@/components/Insights';
import { SpendingTrend } from '@/components/SpendingTrend';
import { WeeklyRecapCard } from '@/components/WeeklyRecap';
import { Label, ListRow, PaceBar, Screen, Section, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { bucketPace, byAttention, daysInMonth, formatCents, paceTag, weeklyAllowance } from '@/src/domain';

export default function BudgetScreen() {
  const { statuses, impact, trend, forecast, month, today, insights, recap, bills, tuneUps, trends } = useBudget();
  const t = useTheme();
  const days = daysInMonth(month);
  const $ = (c: number) => formatCents(c, { showCents: false });
  const totalLimit = statuses.reduce((s, b) => s + b.bucket.monthlyLimit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  // The summary uses the same month-end outlook as Insights, so the two always agree.
  const outlook = insights.find((i) => i.kind === 'month_projection');
  const daysLeft = Math.max(1, days - today);
  const weeklyLeft = Math.max(0, totalLimit - totalSpent) / daysLeft * 7;

  return (
    <Screen>
      <Section title="Spending trend">
        <View style={{ padding: 16 }}>
          <SpendingTrend trend={trend} forecast={forecast} month={month} />
        </View>
      </Section>

      <InsightsCard insights={insights} />

      <WeeklyRecapCard recap={recap} />

      <Section title="This month">
        <View style={{ padding: 16, gap: 4 }}>
          <View style={styles.between}>
            <Label style={{ fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{$(totalSpent)} <Label secondary style={{ fontSize: 15, fontWeight: '400' }}>of {$(totalLimit)}</Label></Label>
            {outlook && <Tag tone={outlook.card.tone}>{outlook.card.tag}</Tag>}
          </View>
          <Label secondary style={{ fontSize: 13 }}>
            {daysLeft >= 7 ? `${$(weeklyLeft)}/week left overall` : `${$(totalLimit - totalSpent)} left for ${daysLeft} days`}
            {impact.hitsSavings > 0 ? ` · ${$(impact.hitsSavings)} coming out of savings` : ''}
          </Label>
          <PaceBar ratio={totalSpent / Math.max(1, totalLimit)} tone={outlook?.card.tone ?? 'good'} paceAt={today / days} />
        </View>
      </Section>

      <BillsCard outlook={bills} />

      <Section title="Buckets">
        {byAttention(statuses, today, days).map((s, i, all) => {
          const pace = bucketPace(s, today, days);
          const tag = paceTag(s, pace);
          return (
            <ListRow key={s.bucket.id} title={s.bucket.name} figure={`${$(s.spent)} / ${$(s.bucket.monthlyLimit)}`}
              figureTone={tag.tone === 'bad' ? 'bad' : undefined}
              note={weeklyAllowance(s, today, days).text} tag={tag.tone === 'good' ? null : { tone: tag.tone, text: tag.tag }}
              leading={<View style={[styles.icon, { backgroundColor: t.track }]}>
                <SymbolView name={{ ios: s.bucket.icon as any, android: 'category', web: 'category' }} size={15} tintColor={t.secondaryText} />
              </View>}
              bar={<PaceBar ratio={s.ratio} tone={tag.tone} paceAt={pace.monthElapsed} />}
              onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: s.bucket.id } })} last={i === all.length - 1} />
          );
        })}
      </Section>


      <Section>
        <ListRow title="Patterns & tune-ups" last onPress={() => router.push('/patterns')}
          note={[tuneUps.length ? `${tuneUps.length} budget suggestion${tuneUps.length === 1 ? '' : 's'}` : 'Limits match your spending',
            trends.length ? `${trends.length} change${trends.length === 1 ? '' : 's'} from usual` : null].filter(Boolean).join(' · ')} />
      </Section>

      <Link href="/new-bucket" asChild>
        <Pressable accessibilityRole="button"><Label style={{ color: t.tint, fontSize: 17, textAlign: 'center' }}>Add custom bucket</Label></Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
