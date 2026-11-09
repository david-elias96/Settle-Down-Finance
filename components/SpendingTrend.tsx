import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Label, useTheme } from '@/components/ui';
import { daysInMonth, formatCents, previousMonth, type MonthComparison, type MonthForecast, type TrendPoint } from '@/src/domain';

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

const monthName = (m: string, style: 'long' | 'short' = 'short') =>
  new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: style, timeZone: 'UTC' });

/** A "nice" axis maximum: 1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × a power of ten, in dollars. */
function niceMax(cents: number) {
  const dollars = Math.max(cents / 100, 100);
  const pow = 10 ** Math.floor(Math.log10(dollars));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * pow >= dollars)! * pow;
  return step * 100;
}

/**
 * Running total of this month's spending (blue) against last month's (gray, dashed)
 * as the benchmark, plus a dotted projection to month end with a shaded likely range.
 * Drag across the chart to compare any day.
 */
export function SpendingTrend({ trend, forecast, month }: { trend: MonthComparison; forecast?: MonthForecast; month: string }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  // "So far" shows actual spending only; "Projected" adds the month-end forecast.
  const [mode, setMode] = useState<'actual' | 'projected'>('actual');
  const projection = mode === 'projected' && forecast && forecast.points.length > 1 ? forecast : null;

  const days = daysInMonth(month);
  const prevMonth = previousMonth(month);
  const yMax = niceMax(Math.max(trend.previousTotal, trend.spentSoFar, projection?.end.high ?? 0));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + ((day - 1) / (days - 1)) * plotW;
  const y = (cents: number) => PAD.top + plotH - (Math.max(0, cents) / yMax) * plotH;

  const path = (pts: TrendPoint[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(Math.min(p.day, days)).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ');
  const currentPath = useMemo(() => path(trend.current), [trend, width, yMax]);
  const prevEnd = trend.previous.at(Math.min(days, trend.previous.length) - 1);
  const previousPath = useMemo(() => path(trend.previous.slice(0, days)), [trend, width, yMax]);

  const projectedPath = useMemo(
    () => (projection ? path(projection.points.map((p) => ({ day: p.day, cumulative: p.mid }))) : ''),
    [projection, width, yMax],
  );
  // Likely range: along the low edge, then back along the high edge.
  const bandPath = useMemo(() => {
    if (!projection || projection.method !== 'monte_carlo') return '';
    const pts = projection.points;
    return `${pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.low).toFixed(1)}`).join(' ')} ${
      [...pts].reverse().map((p) => `L${x(p.day).toFixed(1)},${y(p.high).toFixed(1)}`).join(' ')} Z`;
  }, [projection, width, yMax]);

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
  const proj = !cur ? projection?.points.find((p) => p.day === active) : undefined;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        {projection ? (
          <View style={{ flexShrink: 1 }}>
            <Label secondary style={{ fontSize: 13 }}>Projected for {monthName(month, 'long')}</Label>
            <Label style={{ fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }}>~{formatCents(projection.end.mid, { showCents: false })}</Label>
            <Label secondary style={{ fontSize: 13 }}>
              {projection.end.high > projection.end.low
                ? `Likely ${formatCents(projection.end.low, { showCents: false })}–${formatCents(projection.end.high, { showCents: false })}`
                : 'At your current pace'}
            </Label>
          </View>
        ) : (
          <View style={{ flexShrink: 1 }}>
            <Label secondary style={{ fontSize: 13 }}>Spent so far in {monthName(month, 'long')}</Label>
            <Label style={{ fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatCents(trend.spentSoFar, { showCents: false })}</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Label style={{ color: up ? t.red : t.green, fontSize: 13 }}>{up ? '▲' : '▼'}</Label>
              <Label secondary style={{ fontSize: 13 }}>
                {formatCents(Math.abs(trend.difference), { showCents: false })} {up ? 'more' : 'less'} than {monthName(prevMonth)} {Math.min(last?.day ?? 1, trend.previous.length || 1)}
              </Label>
            </View>
          </View>
        )}
        {forecast && forecast.points.length > 1 && (
          <View style={[styles.segment, { backgroundColor: t.track }]} accessibilityRole="tablist">
            {(['actual', 'projected'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setActiveDay(null); }} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                style={[styles.segmentItem, mode === m && { backgroundColor: t.card }]}>
                <Label style={{ fontSize: 13, fontWeight: mode === m ? '600' : '400' }}>{m === 'actual' ? 'So far' : 'Projected'}</Label>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Readout for the day under the finger (defaults to today). */}
      <View style={{ flexDirection: 'row', gap: 16, minHeight: 18 }}>
        {proj ? (
          <Legend color={t.tint} dotted label={`${monthName(month)} ${active} projected: ${formatCents(proj.mid, { showCents: false })}`} />
        ) : (
          <Legend color={t.tint} label={`${monthName(month)} ${active}: ${cur ? formatCents(cur.cumulative, { showCents: false }) : '–'}`} />
        )}
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
        accessibilityLabel={`Spending this month ${formatCents(trend.spentSoFar)} so far, compared with ${formatCents(trend.previousByThisDay)} by the same day last month.${projection ? ` Projected month end about ${formatCents(projection.end.mid, { showCents: false })}, likely between ${formatCents(projection.end.low, { showCents: false })} and ${formatCents(projection.end.high, { showCents: false })}.` : ''}`}
        style={{ height: HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((v) => (
              <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={t.separator} strokeWidth={1} />
            ))}
            <Path d={previousPath} stroke={t.secondaryText} strokeWidth={2} strokeDasharray="5 4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {/* Benchmark at last month's total, drawn see-through on top so last month's dashed
                line shows through it and flows into it where they meet. */}
            {trend.previousTotal > 0 && (
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(trend.previousTotal)} y2={y(trend.previousTotal)}
                stroke={t.secondaryText} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
            )}
            {prevEnd && (
              <Circle cx={x(Math.min(prevEnd.day, days))} cy={y(prevEnd.cumulative)} r={4} fill={t.secondaryText} stroke={t.card} strokeWidth={2} />
            )}
            {bandPath ? <Path d={bandPath} fill={t.tint} fillOpacity={0.12} stroke="none" /> : null}
            {projectedPath ? (
              <Path d={projectedPath} stroke={t.tint} strokeOpacity={0.75} strokeWidth={2} strokeDasharray="0.1 5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            <Path d={currentPath} stroke={t.tint} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

            {activeDay != null && (
              <Line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke={t.secondaryText} strokeWidth={1} />
            )}
            {prev && activeDay != null && (
              <Circle cx={x(Math.min(active, days))} cy={y(prev.cumulative)} r={4} fill={t.secondaryText} stroke={t.card} strokeWidth={2} />
            )}
            {proj && activeDay != null && (
              <Circle cx={x(active)} cy={y(proj.mid)} r={4} fill={t.card} stroke={t.tint} strokeWidth={2} />
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

function Legend({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.swatch, { borderColor: color, borderStyle: dotted ? 'dotted' : dashed ? 'dashed' : 'solid' }]} />
      <Label secondary style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 16, height: 0, borderTopWidth: 2 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, marginTop: 2 },
  segmentItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
});
