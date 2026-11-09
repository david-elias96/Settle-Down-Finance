import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Label, Section, useTheme } from '@/components/ui';
import type { Insight } from '@/src/domain';

const ICON: Record<Insight['kind'], string> = {
  month_projection: '↗', over_budget: '!', overspend_risk: '▲', unusual_vendor: '●', subscription_change: '↻', under_budget: '✓',
};

const open = (i: Insight) =>
  i.kind === 'subscription_change' ? router.push('/subscriptions')
    : i.bucketId ? router.push({ pathname: '/bucket/[id]', params: { id: i.bucketId } })
    : router.push('/ask');

/**
 * Month-end outlook on top, then the top alerts as rows: name and one short line on the
 * left, the key number and a status tag on the right. Tapping opens the bucket.
 */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const t = useTheme();
  if (!insights.length) return null;
  const tone = { good: t.green, warn: t.orange, bad: t.red };
  const outlook = insights[0].kind === 'month_projection' ? insights[0] : null;
  const alerts = insights.filter((i) => i !== outlook).slice(0, 3);

  const Tag = ({ i }: { i: Insight }) => (
    <View style={[styles.tag, { backgroundColor: `${tone[i.card.tone]}1F` }]}>
      <Label style={{ color: tone[i.card.tone], fontSize: 12, fontWeight: '600' }}>{i.card.tag}</Label>
    </View>
  );

  return (
    <Section title="Insights">
      {outlook && (
        <Pressable onPress={() => router.push('/ask')} accessibilityRole="button" style={[styles.outlook, { borderBottomColor: t.separator }]}>
          <Label secondary style={{ fontSize: 13 }}>Month-end outlook</Label>
          <View style={styles.between}>
            <Label style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{outlook.card.figure}</Label>
            <Tag i={outlook} />
          </View>
          <Label secondary style={{ fontSize: 13 }}>{outlook.card.note}</Label>
        </Pressable>
      )}

      {alerts.map((i, n) => (
        <Pressable key={i.id} onPress={() => open(i)} accessibilityRole="button" accessibilityLabel={`${i.title}. ${i.body}`}
          style={[styles.row, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}>
          <View style={[styles.icon, { backgroundColor: `${tone[i.card.tone]}1F` }]}>
            <Label style={{ color: tone[i.card.tone], fontSize: 14, fontWeight: '700' }}>{ICON[i.kind]}</Label>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.between}>
              <Label style={{ fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{i.card.label}</Label>
              <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{i.card.figure}</Label>
            </View>
            <View style={styles.between}>
              <Label secondary style={{ fontSize: 13, flexShrink: 1 }}>{i.card.note}</Label>
              <Tag i={i} />
            </View>
          </View>
        </Pressable>
      ))}

      <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'How can I cut my spending this month?' } })} accessibilityRole="button">
        <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }}>
          <Label style={{ color: t.tint, fontSize: 15 }}>Ask how to cut spending this month →</Label>
        </View>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  outlook: { paddingHorizontal: 16, paddingVertical: 14, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'flex-start' },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});
