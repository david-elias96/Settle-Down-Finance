import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GroveTree } from '@/components/GroveTree';
import { Button, Display, HeroCard, IconChip, Label, ListRow, PaceBar, Screen, Section, SettingsButton, toneColor, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, goalForecast } from '@/src/domain';

export default function SavingsScreen() {
  const { impact, month, statuses } = useBudget();
  // Same count as the home headline ("On track. 1 bucket over.").
  const bucketsOver = statuses.filter((st) => st.overBy > 0).length;
  const t = useTheme();
  const $ = (c: number) => formatCents(c, { showCents: false });
  const over = impact.totalOverspend;
  const parts = [
    { label: 'Other trees cover it', amount: impact.coveredByOtherBuckets, tone: 'good' as const, fill: 1 },
    { label: 'Savings cover it', amount: impact.hitsSavings - impact.uncovered, tone: 'warn' as const, fill: 0.5 },
    { label: 'Not covered yet', amount: impact.uncovered, tone: 'bad' as const, fill: 0 },
  ].filter((p) => p.amount > 0);
  const totalSaved = impact.goals.reduce((s, g) => s + g.balanceAfter, 0);

  return (
    <Screen title="Savings" action={<SettingsButton />}>
      <HeroCard style={{ gap: 2 }}>
        <View accessible accessibilityRole="header" aria-label={`Saved across goals: ${$(totalSaved)}. ${over === 0 ? 'Savings are safe this month.' : `${formatCents(impact.hitsSavings)} of overspending comes out of savings this month.`}`} style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: t.heroMuted }}>Saved across goals</Text>
          <Display size={48} color={t.heroText} style={{ lineHeight: 54, letterSpacing: -1.4 }}>{$(totalSaved)}</Display>
          <Text style={{ fontSize: 15, color: impact.hitsSavings > 0 ? t.sun : t.heroMuted }}>
            {impact.hitsSavings > 0 ? `−${formatCents(impact.hitsSavings)} to cover overspending` : 'Safe this month'}
          </Text>
        </View>
      </HeroCard>

      <Section title="Overspending">
        {over === 0 ? (
          <ListRow title="None" note="Every bucket within its limit" tag={{ tone: 'good', text: 'Savings safe' }} last
            leading={<IconChip icon={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} />} />
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            <Label style={{ fontSize: 17, fontWeight: '600' }}>{$(over)} over in {bucketsOver} bucket{bucketsOver === 1 ? '' : 's'}</Label>
            {/* One bar, split by what absorbs the overspending. */}
            <View style={[styles.stack, { backgroundColor: t.track }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {parts.map((p) => (
                <View key={p.label} style={{ flex: p.amount, backgroundColor: toneColor(t, p.tone) }} />
              ))}
            </View>
            {parts.map((p) => (
              <View key={p.label} style={styles.legend} accessible accessibilityLabel={`${p.label}: ${formatCents(p.amount)}`}>
                <GroveTree size={26} fill={p.fill} tone={p.tone} />
                <Label style={{ fontSize: 15, flex: 1 }}>{p.label}</Label>
                <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCents(p.amount)}</Label>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Goals">
        {impact.goals.length === 0 && (
          <ListRow title="No savings goals yet" note="A trip, a car, a rainy day" last
            leading={<IconChip icon={{ ios: 'leaf.fill', android: 'savings', web: 'savings' }} />} />
        )}
        {impact.goals.map(({ goal, drawn, balanceAfter, monthsDelayed }, i) => {
          const f = goalForecast(goal, balanceAfter, month);
          const tag = drawn > 0 ? { tone: 'warn' as const, text: `Pushed back ${monthsDelayed} mo` }
            : f.onTime === false ? { tone: 'warn' as const, text: 'Behind' }
            : { tone: 'good' as const, text: f.finishLabel === 'Reached' ? 'Reached' : 'On track' };
          return (
            <ListRow key={goal.id} title={goal.name} figure={$(balanceAfter)}
              note={`of ${$(goal.target)} · ${f.finishLabel === 'Reached' ? 'reached' : f.finishLabel}${drawn > 0 ? ` · −${$(drawn)} this month` : ''}`}
              tag={tag} bar={<PaceBar ratio={balanceAfter / goal.target} tone={tag.tone} />} last={i === impact.goals.length - 1}
              leading={<GroveTree size={40} fill={goal.target > 0 ? balanceAfter / goal.target : 0} tone={tag.tone === 'warn' ? 'warn' : 'good'} />}
              onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} />
          );
        })}
      </Section>

      {impact.goals.length > 1 && (
        <Section>
          <ListRow title="Change goal order" note="Which is protected first" last
            leading={<IconChip icon={{ ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' }} />}
            onPress={() => router.push('/goal-order')} />
        </Section>
      )}

      <Button title="Add savings goal" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/goal')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
