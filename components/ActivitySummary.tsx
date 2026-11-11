import { Text, View } from 'react-native';
import { Display, HeroCard, useTheme } from '@/components/ui';
import { formatCents, type Cents } from '@/src/domain';

export interface SummaryData {
  /** What the numbers cover, e.g. "Spent in November" or "Groceries in November". */
  scope: string;
  count: number;
  total: Cents;
}

/** The green card at the top of Activity: how much was spent, over how many purchases. */
export function ActivitySummary({ data }: { data: SummaryData }) {
  const t = useTheme();
  const { scope, count, total } = data;
  const countText = `${count} purchase${count === 1 ? '' : 's'}`;
  return (
    <HeroCard style={{ gap: 2 }}>
      <View accessible accessibilityRole="header" aria-label={`${scope}: ${formatCents(total)} over ${countText}`} style={{ gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: t.heroMuted }}>{scope}</Text>
        <Display size={48} color={t.heroText} style={{ lineHeight: 54, letterSpacing: -1.4 }}>{formatCents(total, { showCents: false })}</Display>
        <Text style={{ fontSize: 15, color: t.heroMuted }}>{countText}</Text>
      </View>
    </HeroCard>
  );
}
