import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Label, Row, Section, useTheme } from '@/components/ui';
import type { Insight } from '@/src/domain';

const ICON: Record<Insight['kind'], string> = {
  month_projection: '↗', over_budget: '▲', overspend_risk: '▲', unusual_vendor: '●', subscription_change: '↻', under_budget: '▼',
};

/** Top spending insights, found by the budget logic. Tapping one opens its bucket or the Ask tab. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const t = useTheme();
  if (!insights.length) return null;
  const color = (i: Insight) => (i.kind === 'month_projection' ? (i.priority === 3 ? t.red : t.tint) : i.kind === 'over_budget' ? t.red : i.kind === 'under_budget' ? t.green : t.orange);
  // The month-end outlook plus the top three alerts.
  const shown = insights.slice(0, insights[0]?.kind === 'month_projection' ? 4 : 3);
  return (
    <Section title="Insights">
      {shown.map((i, n) => (
        <Pressable key={i.id} accessibilityRole="button"
          onPress={() => i.bucketId ? router.push({ pathname: '/bucket/[id]', params: { id: i.bucketId } }) : router.push('/ask')}>
          <Row title={i.title} subtitle={i.body} last={n === shown.length - 1}
            right={<View style={{ width: 20, alignItems: 'center' }}><Label style={{ color: color(i), fontSize: 15 }}>{ICON[i.kind]}</Label></View>} />
        </Pressable>
      ))}
      <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'How can I cut my spending this month?' } })} accessibilityRole="button">
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: t.separator }}>
          <Label style={{ color: t.tint, fontSize: 15 }}>Ask how to cut spending this month →</Label>
        </View>
      </Pressable>
    </Section>
  );
}
