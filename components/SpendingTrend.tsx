import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Label, useTheme } from '@/components/ui';
import { daysInMonth, formatCents, previousMonth, type MonthComparison, type TrendPoint } from '@/src/domain';

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

const monthName = (m: string, style: 'long' | 'short' = 'short') =>
  new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: style, timeZone: 'UTC' });

/** A "nice" axis maximum: 1, 2, 2.5 or 5 × a power of ten, in dollars. */
function niceMax(cents: number) {
  const dollars = Math.max(cents / 100, 100);
  const pow = 10 ** Math.floor(Math.log10(dollars));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= dollars)! * pow;
  return step * 100;
}

/**
 * Running total of this month's spending (blue) against last month's (gray, dashed)
 * as the benchmark. Drag across the chart to compare any day.
 */
export function SpendingTrend({ trend, month }: { trend: MonthComparison; month: string }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const days = daysInMonth(month);
  const prevMonth = previousMonth(month);
  const yMax = niceMax(Math.max(trend.previousTotal, trend.spentSoFar));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + ((day - 1) / (days - 1)) * plotW;
  const y = (cents: number) => PAD.top + plotH - (Math.max(0, cents) / yMax) * plotH;

  const path = (pts: TrendPoint[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(Math.min(p.day, days)).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ');
  const currentPath = useMemo(() => path(trend.current), [trend, width]);
  const prevEnd = trend.previous.at(Math.min(days, trend.previous.length) - 1);
  const previousPath = useMemo(() => path(trend.previous.slice(0, days)), [trend, width]);

  const last = trend.current.at(-1);
  const ticks = [0, 0.5, 1].map((f) => f * yMax);

  const onTouch = (e: GestureResponderEvent) => {
    if (!plotW) return;
    const day = Math.round(((e.nativeEvent.locationX - PAD.left) / plotW) * (days - 1)) + 1;
    setActiveDay(Math.min(days, Math.max(1, day)));
  };

  const up = trend.difference > 0;
  const active = activeDay ?? last?.day ?? 1;
  const cur = trend.current.find((p) => p.day === active);
  const prev = trend.previous[Math.min(active, trend.previous.length) - 1];

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Label secondary style={{ fontSize: 13 }}>Spent so far in {monthName(month, 'long')}</Label>
        <Label style={{ fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatCents(trend.spentSoFar, { showCents: false })}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Label style={{ color: up ? t.red : t.green, fontSize: 13 }}>{up ? '▲' : '▼'}</Label>
          <Label secondary style={{ fontSize: 13 }}>
            {formatCents(Math.abs(trend.difference), { showCents: false })} {up ? 'more' : 'less'} than this point in {monthName(prevMonth, 'long')}
          </Label>
        </View>
      </View>

      {/* Readout for the day under the finger (defaults to today). */}
      <View style={{ flexDirection: 'row', gap: 16, minHeight: 18 }}>
        <Legend color={t.tint} label={`${monthName(month)} ${active}: ${cur ? formatCents(cur.cumulative, { showCents: false }) : '–'}`} />
        <Legend color={t.secondaryText} dashed label={`${monthName(prevMonth)} ${Math.min(active, trend.previous.length)}: ${prev ? formatCents(prev.cumulative, { showCents: false }) : '–'}`} />
      </View>

      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderRelease={() => setActiveDay(null)}
        onResponderTerminationRequest={() => false}
        accessibilityRole="image"
        accessibilityLabel={`Spending this month ${formatCents(trend.spentSoFar)} so far, compared with ${formatCents(trend.previousByThisDay)} by the same day last month.`}
        style={{ height: HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((v) => (
              <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={t.separator} strokeWidth={1} />
            ))}
            {/* Solid benchmark at last month's total. Drawn faint and underneath so last month's
                dashed line visibly climbs into it instead of being covered by it. */}
            {trend.previousTotal > 0 && (
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(trend.previousTotal)} y2={y(trend.previousTotal)}
                stroke={t.secondaryText} strokeOpacity={0.45} strokeWidth={1.5} />
            )}
            {/* Surface-colored halo separates the dashed line from the benchmark where they meet. */}
            <Path d={previousPath} stroke={t.card} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={previousPath} stroke={t.secondaryText} strokeWidth={2} strokeDasharray="5 4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {prevEnd && (
              <Circle cx={x(Math.min(prevEnd.day, days))} cy={y(prevEnd.cumulative)} r={4} fill={t.secondaryText} stroke={t.card} strokeWidth={2} />
            )}
            <Path d={currentPath} stroke={t.tint} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

            {activeDay != null && (
              <Line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke={t.secondaryText} strokeWidth={1} />
            )}
            {prev && activeDay != null && (
              <Circle cx={x(Math.min(active, days))} cy={y(prev.cumulative)} r={4} fill={t.secondaryText} stroke={t.card} strokeWidth={2} />
            )}
            {(activeDay == null ? last : cur) && (
              <Circle cx={x((activeDay == null ? last! : cur!).day)} cy={y((activeDay == null ? last! : cur!).cumulative)} r={5}
                fill={t.tint} stroke={t.card} strokeWidth={2} />
            )}
          </Svg>
        )}
        {/* Axis labels as native text so they use the system font. */}
        {width > 0 && ticks.map((v) => (
          <Axis key={`l${v}`} style={{ left: 0, width: PAD.left - 6, top: y(v) - 8, textAlign: 'right' }}>
            {compact(v)}
          </Axis>
        ))}
        {width > 0 && [1, 15, days].map((d) => (
          <Axis key={`d${d}`} style={{ top: HEIGHT - 16, width: 60, textAlign: d === 1 ? 'left' : d === days ? 'right' : 'center',
            left: d === 1 ? x(1) : d === days ? x(days) - 60 : x(d) - 30 }}>
            {`${monthName(month)} ${d}`}
          </Axis>
        ))}
        {width > 0 && trend.previousTotal > 0 && (
          <Axis style={{ left: PAD.left + 4, top: y(trend.previousTotal) - 17 }}>
            {`${monthName(prevMonth)} total ${formatCents(trend.previousTotal, { showCents: false })}`}
          </Axis>
        )}
      </View>
    </View>
  );
}

/** Short axis label: $0, $500, $1.5k, $2k. */
const compact = (cents: number) => {
  const d = cents / 100;
  return d >= 1000 ? `$${+(d / 1000).toFixed(1)}k` : `$${d}`;
};

function Axis({ children, style }: { children: string; style: object }) {
  const t = useTheme();
  return <Text numberOfLines={1} pointerEvents="none" style={[{ position: 'absolute', fontSize: 11, color: t.secondaryText, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.swatch, { borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Label secondary style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 16, height: 0, borderTopWidth: 2 },
});
