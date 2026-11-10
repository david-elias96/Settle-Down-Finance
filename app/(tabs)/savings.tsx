import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Label, ListRow, PaceBar, Row, Screen, Section, toneColor, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, goalForecast } from '@/src/domain';

export default function SavingsScreen() {
  const { impact, month } = useBudget();
  const t = useTheme();
  const $ = (c: number) => formatCents(c, { showCents: false });
  const over = impact.totalOverspend;
  const parts = [
    { label: 'Covered by other buckets', amount: impact.coveredByOtherBuckets, tone: 'good' as const },
    { label: 'Taken from savings goals', amount: impact.hitsSavings - impact.uncovered, tone: 'warn' as const },
    { label: 'Not covered', amount: impact.uncovered, tone: 'bad' as const },
  ].filter((p) => p.amount > 0);
  const totalSaved = impact.goals.reduce((s, g) => s + g.balanceAfter, 0);

  return (
    <Screen>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Label secondary style={{ fontSize: 13 }}>Saved across goals</Label>
        <Label style={{ fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{$(totalSaved)}</Label>
      </View>

      <Section title="Overspending this month">
        {over === 0 ? (
          <ListRow title="No overspending" note="Every bucket is within its limit, so savings are untouched." tag={{ tone: 'good', text: 'Savings safe' }} last />
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            <Label style={{ fontSize: 17, fontWeight: '600' }}>{formatCents(over)} over budget. Here's where it comes from:</Label>
            {/* One bar, split by what absorbs the overspending. */}
            <View style={[styles.stack, { backgroundColor: t.track }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {parts.map((p) => (
                <View key={p.label} style={{ flex: p.amount, backgroundColor: toneColor(t, p.tone) }} />
              ))}
            </View>
            {parts.map((p) => (
              <View key={p.label} style={styles.legend} accessible accessibilityLabel={`${p.label}: ${formatCents(p.amount)}`}>
                <View style={[styles.swatch, { backgroundColor: toneColor(t, p.tone) }]} />
                <Label style={{ fontSize: 15, flex: 1 }}>{p.label}</Label>
                <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCents(p.amount)}</Label>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Goals">
        {impact.goals.length === 0 && (
          <ListRow title="No savings goals yet" note="Add one for a trip, a car, or a rainy day." last />
        )}
        {impact.goals.map(({ goal, drawn, balanceAfter, monthsDelayed }, i) => {
          const f = goalForecast(goal, balanceAfter, month);
          const tag = drawn > 0 ? { tone: 'warn' as const, text: `Pushed back ${monthsDelayed} mo` }
            : f.onTime === false ? { tone: 'warn' as const, text: 'Behind' }
            : { tone: 'good' as const, text: f.finishLabel === 'Reached' ? 'Reached' : 'On track' };
          return (
            <ListRow key={goal.id} title={goal.name} figure={`${$(balanceAfter)} / ${$(goal.target)}`}
              note={`+${$(goal.monthlyContribution)}/mo · ${f.finishLabel === 'Reached' ? 'goal reached' : `done ${f.finishLabel}`}${drawn > 0 ? ` · −${$(drawn)} this month` : ''}`}
              tag={tag} bar={<PaceBar ratio={balanceAfter / goal.target} tone={tag.tone} />} last={i === impact.goals.length - 1}
              onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} />
          );
        })}
      </Section>

      <Section>
        <Pressable accessibilityRole="button" onPress={() => router.push('/goal')}>
          <Row icon={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} title="Add savings goal" last={impact.goals.length < 2} />
        </Pressable>
        {impact.goals.length > 1 && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/goal-order')}>
            <Row icon={{ ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' }} title="Change goal order" subtitle="Pick which goal is protected first" last />
          </Pressable>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
