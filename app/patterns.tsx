import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Display, Label, ListRow, Screen, Section, Tag, space, useTheme } from '@/components/ui';
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
          <View style={styles.row}><Label secondary style={{ fontSize: 15, lineHeight: 21 }}>Your limits match how you spend. Nothing to change.</Label></View>
        )}
        {rows.map((u, i) => {
          const done = !!applied[u.bucketId];
          return (
            <View key={u.bucketId} style={[styles.row, i > 0 && sep]}>
              <Pressable style={{ flex: 1, gap: 3 }} onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: u.bucketId } })}
                accessibilityRole="button" aria-label={`${u.name}: ${u.kind} from ${$(u.limit)} to ${$(u.suggested)}. ${u.reason}`}>
                <Label style={{ fontSize: 16, fontWeight: '600' }}>{u.name}</Label>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Label secondary style={{ fontSize: 15, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] }}>{$(u.limit)}</Label>
                  <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={12} weight="semibold" tintColor={t.secondaryText} />
                  <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{$(u.suggested)}</Label>
                </View>
                <Label secondary style={{ fontSize: 13, lineHeight: 18 }}>{u.reason}</Label>
              </Pressable>
              {done ? <Tag tone="good">Applied</Tag>
                : <Button small variant="secondary" title="Apply" onPress={() => apply(u)} accessibilityLabel={`Apply: set ${u.name} to ${$(u.suggested)}`} />}
            </View>
          );
        })}
        {pending.length > 1 && (
          <View style={[styles.applyAll, sep]}>
            <Button title={`Apply all ${pending.length}`} onPress={() => pending.forEach(apply)} />
            <Label secondary style={{ fontSize: 13, textAlign: 'center' }}>
              {net === 0 ? 'Your monthly budget stays the same' : `Your monthly budget goes ${net > 0 ? 'up' : 'down'} ${$(Math.abs(net))}`}
            </Label>
          </View>
        )}
      </Section>

      {trends.length > 0 && (
        <Section title="Last month vs usual">
          {trends.map((tr, i) => (
            <ListRow key={tr.bucketId} title={tr.name} note={trendNote(tr)} wrapNote last={i === trends.length - 1}
              tag={{ tone: tr.change > 0 ? 'warn' : 'good', text: `${tr.change > 0 ? 'Up' : 'Down'} ${$(Math.abs(tr.change))}` }}
              onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: tr.bucketId } })} />
          ))}
        </Section>
      )}

      {small && (
        <Section title="Small purchases add up" footer="Coffee, snacks and app charges each feel like nothing. Together they're a bucket of their own.">
          <View style={styles.small} accessible aria-label={`${$(small.total)} in small purchases. ${smallNote(small)}`}>
            <Display size={40}>{$(small.total)}</Display>
            <Label secondary style={{ fontSize: 14, lineHeight: 20 }}>{smallNote(small)}</Label>
          </View>
        </Section>
      )}

      <Button variant="secondary" ai title="Ask about my patterns"
        onPress={() => router.push({ pathname: '/ask', params: { q: 'What patterns do you see in my spending?' } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: 14 },
  applyAll: { padding: space.l, gap: space.s + 2 },
  small: { padding: space.l, gap: space.xs },
});
