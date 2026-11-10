import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, GOAL_NAME_MAX, goalForecast, monthInputValue, monthlyNeeded, parseGoalDraft, type GoalDraft } from '@/src/domain';

/** "2027-06-01" → "Jun 2027", matching the finish dates on the Savings tab. */
const shortMonth = (date: string) => new Date(`${date.slice(0, 7)}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** New goal, or edit one with `?id=`. */
export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addGoal, updateGoal, deleteGoal, month } = useBudget();
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
    const note = existing.balance > 0 ? ` The ${$(existing.balance)} set aside stays in your savings account; it just won't be earmarked for this goal.` : '';
    const go = () => { deleteGoal(existing.id); router.back(); };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Delete ${existing.name}?${note}`)) go(); return; }
    Alert.alert(`Delete ${existing.name}?`, note.trim() || undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  if (id && !existing) {
    return <Screen><Label secondary style={{ textAlign: 'center' }}>This goal was deleted.</Label></Screen>;
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

      {(needed !== null || forecast) && (
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          {needed !== null && g?.targetDate && (
            needed === 0
              ? <Label secondary style={{ fontSize: 15 }}>You've already saved enough for this goal.</Label>
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Label secondary style={{ fontSize: 15, flex: 1 }}>To reach it by {shortMonth(g.targetDate)}, set aside {$(needed)} a month.</Label>
                  {g.monthlyContribution !== needed && (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Use ${$(needed)} a month`} hitSlop={8} onPress={() => set('monthly')(String(needed / 100))}>
                      <Label style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>Use {$(needed)}</Label>
                    </Pressable>
                  )}
                </View>
              )
          )}
          {forecast && forecast.finishLabel !== 'Reached' && (
            <Label secondary style={{ fontSize: 15 }}>
              At {$(g!.monthlyContribution)} a month you'll reach it in {forecast.finishLabel}{forecast.onTime === false ? ', after your target date' : ''}.
            </Label>
          )}
        </View>
      )}

      {tried && !parsed.ok && <Label style={{ color: t.red, fontSize: 15, textAlign: 'center' }}>{parsed.error}</Label>}

      <Pressable accessibilityRole="button" onPress={save}>
        <Label style={{ color: t.tint, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{existing ? 'Save changes' : 'Add goal'}</Label>
      </Pressable>
      {existing && (
        <Pressable accessibilityRole="button" onPress={remove}>
          <Label style={{ color: t.red, fontSize: 17, textAlign: 'center' }}>Delete goal</Label>
        </Pressable>
      )}
    </Screen>
  );
}
