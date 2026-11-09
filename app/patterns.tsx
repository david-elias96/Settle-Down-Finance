import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AiMark, Label, Screen, Section, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, smallNote, trendNote, type TuneUp } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });

/** Budget tune-ups, trends and small-purchase habits, from whole past months. */
export default function PatternsScreen() {
  const { tuneUps, trends, small, setBucketLimit } = useBudget();
  const t = useTheme();
  // Applied suggestions stay listed (marked done) so the screen doesn't jump around.
  const [applied, setApplied] = useState<Record<string, TuneUp>>({});
  const rows = [...tuneUps, ...Object.values(applied).filter((a) => !tuneUps.some((u) => u.bucketId === a.bucketId))];
  const pending = tuneUps.filter((u) => !applied[u.bucketId]);
  const net = pending.reduce((s, u) => s + u.suggested - u.limit, 0);
  const apply = (u: TuneUp) => { setBucketLimit(u.bucketId, u.suggested); setApplied((a) => ({ ...a, [u.bucketId]: u })); };
  const sep = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator };

  return (
    <Screen>
      <Section title="Budget tune-ups" footer="Based on your last few whole months, from the cards linked so far. One-off months like a trip are left out.">
        {rows.length === 0 && (
          <View style={styles.row}><Label secondary style={{ fontSize: 15 }}>Your limits match how you spend. Nothing to change.</Label></View>
        )}
        {rows.map((u, i) => {
          const done = !!applied[u.bucketId];
          return (
            <View key={u.bucketId} style={[styles.row, i > 0 && sep]}>
              <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: u.bucketId } })}
                accessibilityRole="button" aria-label={`${u.name}: ${u.kind} from ${$(u.limit)} to ${$(u.suggested)}. ${u.reason}`}>
                <Label style={{ fontSize: 16, fontWeight: '600' }}>{u.name}</Label>
                <Label style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>
                  <Label secondary style={{ textDecorationLine: 'line-through' }}>{$(u.limit)}</Label>  →  {$(u.suggested)}
                </Label>
                <Label secondary style={{ fontSize: 13 }}>{u.reason}</Label>
              </Pressable>
              {done ? <Tag tone="good">Applied</Tag> : (
                <Pressable onPress={() => apply(u)} accessibilityRole="button" aria-label={`Apply: set ${u.name} to ${$(u.suggested)}`}
                  style={[styles.pill, { backgroundColor: `${t.tint}14` }]}>
                  <Label style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>Apply</Label>
                </Pressable>
              )}
            </View>
          );
        })}
        {pending.length > 1 && (
          <Pressable onPress={() => pending.forEach(apply)} accessibilityRole="button" style={[styles.row, sep]}>
            <View style={{ flex: 1 }}>
              <Label style={{ color: t.tint, fontSize: 17 }}>Apply all {pending.length}</Label>
              <Label secondary style={{ fontSize: 13 }}>
                {net === 0 ? 'Your monthly budget stays the same' : `Your monthly budget goes ${net > 0 ? 'up' : 'down'} ${$(Math.abs(net))}`}
              </Label>
            </View>
          </Pressable>
        )}
      </Section>

      {trends.length > 0 && (
        <Section title="Last month vs usual">
          {trends.map((tr, i) => (
            <Pressable key={tr.bucketId} onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: tr.bucketId } })}
              accessibilityRole="button" aria-label={`${tr.name}, ${tr.change > 0 ? 'up' : 'down'} ${$(Math.abs(tr.change))}. ${trendNote(tr)}`}
              style={[styles.row, i > 0 && sep]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Label style={{ fontSize: 16, fontWeight: '600' }}>{tr.name}</Label>
                <Label secondary style={{ fontSize: 13 }}>{trendNote(tr)}</Label>
              </View>
              <Tag tone={tr.change > 0 ? 'warn' : 'good'}>{`${tr.change > 0 ? 'Up' : 'Down'} ${$(Math.abs(tr.change))}`}</Tag>
            </Pressable>
          ))}
        </Section>
      )}

      {small && (
        <Section title="Small purchases add up" footer="Coffee, snacks and app charges each feel like nothing. Together they're a bucket of their own.">
          <View style={styles.row} accessible aria-label={`${$(small.total)} in small purchases. ${smallNote(small)}`}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{$(small.total)}</Label>
              <Label secondary style={{ fontSize: 13 }}>{smallNote(small)}</Label>
            </View>
          </View>
        </Section>
      )}

      <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'What patterns do you see in my spending?' } })}
        accessibilityRole="button" style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AiMark size={16} />
          <Label style={{ color: t.tint, fontSize: 17 }}>Ask about my patterns</Label>
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
});
