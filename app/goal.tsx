import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Label, Notice, Row, Screen, Section, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, GOAL_NAME_MAX, goalForecast, goalIdeas, ideaTargetMonth, isEmergencyFund, monthInputValue, monthlyNeeded, parseGoalDraft, type GoalDraft } from '@/src/domain';

/** "2027-06-01" → "Jun 2027", matching the finish dates on the Savings tab. */
const shortMonth = (date: string) => new Date(`${date.slice(0, 7)}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** New goal, or edit one with `?id=`. */
export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addGoal, updateGoal, deleteGoal, month } = useBudget();
  const ideas = goalIdeas(goals);
  const existing = id ? goals.find((g) => g.id === id) : undefined;
  const t = useTheme();
  const $ = (c: number) => formatCents(c, { showCents: c % 100 !== 0 });

  const [draft, setDraft] = useState<GoalDraft>(() => ({
    name: existing?.name ?? '',
    target: existing ? String(existing.target / 100) : '',
    saved: existing && existing.balance ? String(existing.balance / 100) : '',
    monthly: existing && existing.monthlyContribution ? String(existing.monthlyContribution / 100) : '',
    targetMonth: monthInputValue(existing?.targetDate),
  }));
  // Errors show once someone tries to save, not while they're still typing.
  const [tried, setTried] = useState(false);
  const set = (k: keyof GoalDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const parsed = parseGoalDraft(draft, month);
  const input = { color: t.text, fontSize: 17, width: 150, textAlign: 'right' as const };
  const keyboard = { name: 'default', targetMonth: 'numbers-and-punctuation' } as const;
  const field = (k: keyof GoalDraft, label: string, placeholder: string) => (
    <TextInput accessibilityLabel={label} style={input} value={draft[k]} onChangeText={set(k)} placeholder={placeholder}
      placeholderTextColor={t.secondaryText} keyboardType={k === 'name' || k === 'targetMonth' ? keyboard[k] : 'decimal-pad'}
      maxLength={k === 'name' ? GOAL_NAME_MAX : 16} />
  );

  // Live guidance: what it takes to hit the date, and when the current plan finishes.
  const g = parsed.ok ? parsed.goal : null;
  const needed = g?.targetDate ? monthlyNeeded(g.target, g.balance, g.targetDate.slice(0, 7), month) : null;
  const forecast = g && g.monthlyContribution > 0 ? goalForecast({ ...g, id: '', priority: 0 }, g.balance, month) : null;

  const save = () => {
    setTried(true);
    if (!parsed.ok) return;
    if (existing) updateGoal(existing.id, parsed.goal); else addGoal(parsed.goal);
    router.back();
  };
  const remove = () => {
    if (!existing) return;
    const kept = existing.balance > 0 ? `The ${$(existing.balance)} set aside stays in your savings account; it just won't be earmarked for this goal.` : '';
    const why = isEmergencyFund(existing) ? "This is your cushion for surprises like a job loss or a car repair. You can add it back anytime from Ideas." : '';
    const note = [why, kept].filter(Boolean).join(' ');
    const title = isEmergencyFund(existing) ? 'Delete your Emergency Fund?' : `Delete ${existing.name}?`;
    const go = () => { deleteGoal(existing.id); router.back(); };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`${title}${note ? `\n\n${note}` : ''}`)) go(); return; }
    Alert.alert(title, note || undefined, [
      { text: isEmergencyFund(existing) ? 'Keep It' : 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  if (id && !existing) {
    return <Screen><Notice title="This goal was deleted" /></Screen>;
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit Goal' : 'New Goal' }} />
      <Section>
        <Row title="Name" right={field('name', 'Goal name', 'e.g. New Car')} />
        <Row title="Goal amount" right={field('target', 'Goal amount in dollars', '$0')} />
        <Row title="Saved so far" right={field('saved', 'Amount saved so far in dollars', '$0')} />
        <Row title="Monthly amount" right={field('monthly', 'Monthly amount in dollars', '$0')} />
        <Row title="Target date" subtitle="Optional" right={field('targetMonth', 'Target date, month and year', 'MM/YYYY')} last />
      </Section>

      {!existing && !draft.name.trim() && ideas.length > 0 && (
        <Section title="Ideas">
          <View style={styles.ideas}>
            {ideas.map((idea) => (
              <Pressable key={idea.name} accessibilityRole="button" accessibilityLabel={`Use idea: ${idea.name}`}
                onPress={() => setDraft((d) => ({ ...d, name: idea.name, targetMonth: idea.month && !d.targetMonth ? ideaTargetMonth(idea.month, month) : d.targetMonth }))}
                style={({ pressed }) => [styles.idea, { backgroundColor: t.tintSoft, opacity: pressed ? 0.7 : 1 }]}>
                <SymbolView name={{ ios: idea.icon, android: idea.material, web: idea.material } as SymbolViewProps['name']} size={16} tintColor={t.tint} />
                <Label style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>{idea.name}</Label>
              </Pressable>
            ))}
          </View>
        </Section>
      )}

      {(needed !== null || forecast) && (
        <Section title="Plan">
          {forecast && forecast.finishLabel !== 'Reached' && (
            <Row title={`At ${$(g!.monthlyContribution)} a month`}
              right={(
                <View style={styles.right}>
                  <Label style={styles.figure}>{forecast.finishLabel}</Label>
                  {forecast.onTime !== null && <Tag tone={forecast.onTime ? 'good' : 'warn'}>{forecast.onTime ? 'On time' : 'Late'}</Tag>}
                </View>
              )}
              last={needed === null} />
          )}
          {needed !== null && g?.targetDate && (
            needed === 0
              ? <Row title="Already saved enough" right={<Tag tone="good">Reached</Tag>} last />
              : (
                <Row title={`To finish by ${shortMonth(g.targetDate)}`} subtitle={`${$(needed)} a month`}
                  right={g.monthlyContribution === needed ? <Tag tone="good">Using this</Tag> : (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Use ${$(needed)} a month`} hitSlop={8}
                      onPress={() => set('monthly')(String(needed / 100))} style={[styles.pill, { backgroundColor: t.tintSoft }]}>
                      <Label style={{ color: t.tint, fontSize: 14, fontWeight: '600' }}>Use {$(needed)}</Label>
                    </Pressable>
                  )}
                  last />
              )
          )}
        </Section>
      )}

      {tried && !parsed.ok && (
        <Card padded style={{ backgroundColor: `${t.red}1F`, boxShadow: undefined }}>
          <Label style={{ color: t.redText, fontSize: 15, fontWeight: '500' }}>{parsed.error}</Label>
        </Card>
      )}

      <Button title={existing ? 'Save changes' : 'Add goal'} onPress={save} />
      {existing && <Button variant="plain" title="Delete goal" textColor={t.redText} icon={{ ios: 'trash', android: 'delete', web: 'delete' }} onPress={remove} style={{ marginTop: -12 }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  figure: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18 },
});
