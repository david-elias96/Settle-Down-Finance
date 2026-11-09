import { useState } from 'react';
import { Text, View } from 'react-native';
import { Label, useTheme } from '@/components/ui';
import { formatCents, type Cents } from '@/src/domain';

export interface SummaryData {
  /** What the numbers cover, e.g. "Spent in November" or "Groceries in November". */
  scope: string;
  count: number;
  total: Cents;
}

const BIG = { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] } as const;
const SMALL = { fontSize: 17 } as const;

/** The block at the top of Activity: how much was spent, over how many purchases. */
export function ActivitySummary({ data }: { data: SummaryData }) {
  const t = useTheme();
  const { scope, count, total } = data;
  const countText = `${count} purchase${count === 1 ? '' : 's'}`;
  // Measure the "$" and the count's first digit so the digit sits centered under the "$".
  const [dollarW, setDollarW] = useState(0);
  const [digitW, setDigitW] = useState(0);
  const indent = dollarW && digitW ? Math.max(0, (dollarW - digitW) / 2) : 0;
  return (
    <View accessible accessibilityRole="header" aria-label={`${scope}: ${formatCents(total)} over ${countText}`}
      style={{ backgroundColor: t.card, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, gap: 2 }}>
      <View style={{ position: 'absolute', opacity: 0, flexDirection: 'row' }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={BIG} onLayout={(e) => setDollarW(e.nativeEvent.layout.width)}>$</Text>
        <Text style={SMALL} onLayout={(e) => setDigitW(e.nativeEvent.layout.width)}>{String(count)[0]}</Text>
      </View>
      <Label secondary style={{ fontSize: 13 }}>{scope}</Label>
      <Label style={BIG}>{formatCents(total, { showCents: false })}</Label>
      <Label secondary style={{ ...SMALL, marginLeft: indent }}>{countText}</Label>
    </View>
  );
}
