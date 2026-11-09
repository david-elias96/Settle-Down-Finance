import { View } from 'react-native';
import { Label, useTheme } from '@/components/ui';
import { formatCents, type Cents } from '@/src/domain';

export interface SummaryData {
  /** What the numbers cover, e.g. "Spent in November" or "Groceries in November". */
  scope: string;
  count: number;
  total: Cents;
}

/** The block at the top of Activity: how much was spent, over how many purchases. */
export function ActivitySummary({ data }: { data: SummaryData }) {
  const t = useTheme();
  const { scope, count, total } = data;
  const countText = `${count} purchase${count === 1 ? '' : 's'}`;
  return (
    <View accessible accessibilityRole="header" aria-label={`${scope}: ${formatCents(total)} over ${countText}`}
      style={{ backgroundColor: t.card, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, gap: 2 }}>
      <Label secondary style={{ fontSize: 13 }}>{scope}</Label>
      <Label style={{ fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatCents(total, { showCents: false })}</Label>
      <Label secondary style={{ fontSize: 17 }}>{countText}</Label>
    </View>
  );
}
