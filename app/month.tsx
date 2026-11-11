import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { SpendingTrend } from '@/components/SpendingTrend';
import { Card, Display, HeroCard, Label, ListRow, RangeBar, Screen, Section, space, toneTextColor, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { billFigure, billNote, formatCents, shortDate, type AheadStop } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
const DATE_W = 44;
const RAIL_W = 32;

/**
 * The month ahead: the rest of the month as a path. What's behind you is one line at the
 * top; each day with a bill is a stop showing what's due and what's left after it; the
 * path ends at where the month is likely to finish. The trend chart and the bills already
 * paid sit underneath.
 */
export default function MonthAheadScreen() {
  const t = useTheme();
  const { ahead, free, forecast, trend, month, today, bills, insights } = useBudget();
  const outlook = insights.find((i) => i.kind === 'month_projection');
  const paid = bills.bills.filter((b) => b.status === 'paid').sort((a, b) => a.paid!.date.localeCompare(b.paid!.date));
  const lastDay = `${month}-${String(free.daysLeft + today - 1).padStart(2, '0')}`;
  const finish = forecast ? free.budget - forecast.end.mid : null;
  const dueToday = ahead[0]?.day === today;

  return (
    <Screen>
      <View>
        {today > 1 && (
          <Pressable onPress={() => router.push('/activity')} accessibilityRole="button" accessibilityLabel={`Days 1 to ${today - 1}: ${$(free.spent - free.spentToday)} spent, ${paid.length} bills paid. Opens Activity.`}>
            <Stop date={<Text style={{ fontSize: 12, fontWeight: '600', color: t.secondaryText }}>1–{today - 1}</Text>} node="past" rail="solid" compact>
              <Text style={{ fontSize: 13, color: t.secondaryText, paddingVertical: 2 }}>
                {$(free.spent - free.spentToday)} spent · {paid.length} bill{paid.length === 1 ? '' : 's'} paid
              </Text>
            </Stop>
          </Pressable>
        )}

        {!dueToday && (
          <Stop date={<DateBlock day={today} label="Today" strong />} node="today" rail="dashed">
            <Card padded>
              <Label style={{ fontSize: 15, fontWeight: '600' }}>Nothing due today</Label>
              <Label secondary style={{ fontSize: 13, marginTop: 2 }}>{$(free.perDay)} a day is free to spend</Label>
            </Card>
          </Stop>
        )}

        {ahead.map((s) => (
          <Stop key={s.date} node={s.day === today ? 'today' : 'future'} rail="dashed"
            date={<DateBlock day={s.day} label={s.day === today ? 'Today' : weekday(s.date)} strong={s.day === today} />}>
            <StopCard stop={s} />
          </Stop>
        ))}

        <Stop date={<DateBlock day={Number(lastDay.slice(8, 10))} label={weekday(lastDay)} />} node="finish" rail="none">
          <HeroCard style={{ borderRadius: 18, padding: 14, gap: 2 }}>
            <Text style={{ fontSize: 12, color: t.heroMuted }}>{finish === null ? 'Month ends' : 'Likely finish'}</Text>
            <Display size={20} color={t.heroText}>
              {finish === null ? `${$(free.leftThisMonth)} left` : finish >= 0 ? `${$(finish)} under budget` : `${$(-finish)} over budget`}
            </Display>
            <Text style={{ fontSize: 12, color: t.heroMuted }}>
              {free.leftThisMonth >= 0 ? `${$(free.perDay)} a day for everything else gets you there` : 'Bills still to come are already counted'}
            </Text>
          </HeroCard>
        </Stop>
      </View>

      {outlook && (
        <Section title="Likely finish">
          <View style={{ padding: space.l, gap: 4 }}>
            <Label secondary style={{ fontSize: 13 }}>{outlook.card.label}</Label>
            <Display size={30}>{outlook.card.figure}</Display>
            {outlook.card.range && (
              <View style={{ marginTop: 8 }}>
                <RangeBar {...outlook.card.range} tone={outlook.card.tone} format={$} />
              </View>
            )}
          </View>
        </Section>
      )}

      <Section title="Spending trend">
        <View style={{ padding: space.l }}>
          <SpendingTrend trend={trend} forecast={forecast} month={month} />
        </View>
      </Section>

      {paid.length > 0 && (
        <Section title="Paid this month">
          {paid.map((b, i) => (
            <ListRow key={b.key} title={b.vendor} figure={billFigure(b)} note={billNote(b)} last={i === paid.length - 1}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: b.paid!.transactionId } })} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function DateBlock({ day, label, strong }: { day: number; label: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <>
      <Display size={22} style={{ lineHeight: 24 }}>{String(day)}</Display>
      <Text style={{ fontSize: 11, fontWeight: strong ? '600' : '500', color: strong ? t.tint : t.secondaryText }}>{label}</Text>
    </>
  );
}

/** One row of the path: the date, the rail with its node, and the content. */
function Stop({ date, node, rail, compact, children }: {
  date: React.ReactNode; node: 'past' | 'today' | 'future' | 'finish'; rail: 'solid' | 'dashed' | 'none'; compact?: boolean; children: React.ReactNode;
}) {
  const t = useTheme();
  const [h, setH] = useState(0);
  const nodeTop = compact ? 7 : node === 'today' || node === 'finish' ? 9 : 11;
  const size = node === 'past' ? 8 : node === 'future' ? 10 : 14;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingBottom: compact ? 8 : 12 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={{ width: DATE_W, alignItems: 'flex-end', paddingTop: compact ? 3 : 6 }}>{date}</View>
      <View style={{ width: RAIL_W, alignSelf: 'stretch', alignItems: 'center' }}>
        {rail !== 'none' && h > 0 && (
          // The rail runs from this node to the next row's node.
          <Svg width={2} height={h} style={{ position: 'absolute', top: nodeTop + size / 2 }}>
            <Line x1={1} x2={1} y1={0} y2={h} stroke={rail === 'solid' ? t.tint : t.tabIconDefault} strokeOpacity={rail === 'solid' ? 1 : 0.55} strokeWidth={2} strokeDasharray={rail === 'dashed' ? '4 4' : undefined} />
          </Svg>
        )}
        <View style={[{ marginTop: nodeTop, width: size, height: size, borderRadius: size / 2 },
          node === 'past' && { backgroundColor: t.tint },
          node === 'future' && { backgroundColor: t.background, borderWidth: 2, borderColor: t.tint },
          node === 'today' && { backgroundColor: t.tint, boxShadow: `0 0 0 2px ${t.background}, 0 0 0 6px ${t.tint}33` },
          node === 'finish' && { backgroundColor: t.leaf, boxShadow: `0 0 0 2px ${t.background}` }]} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function StopCard({ stop }: { stop: AheadStop }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }} accessible
        aria-label={`${shortDate(stop.date)}: ${stop.bills.map((b) => `${b.vendor}, ${billFigure(b).replace('–', ' to ')}`).join('; ')}. ${$(stop.leftAfter)} left after.`}>
        {stop.bills.map((b) => (
          <View key={b.key} style={{ gap: 2 }}>
            <View style={styles.between}>
              <Label style={{ fontSize: 15, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{b.vendor}</Label>
              <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{billFigure(b)}</Label>
            </View>
            {b.status === 'late' && <Text style={{ fontSize: 12, color: toneTextColor(t, 'warn') }}>{billNote(b)}</Text>}
          </View>
        ))}
        <View style={[styles.between, { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}>
          <Label secondary style={{ fontSize: 12 }}>Left after</Label>
          <Label style={{ fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{$(stop.leftAfter)}</Label>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
