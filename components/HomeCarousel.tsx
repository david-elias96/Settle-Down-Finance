import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLayout } from '@/src/lib/layout';
import { SpendingTrend } from '@/components/SpendingTrend';
import { Display, HeroCard, space, useTheme } from '@/components/ui';
import {
  billFigure, daysInMonth, formatCents, shortDate,
  type AheadStop, type FreeToSpend, type MonthComparison, type MonthForecast,
} from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * The top of the home screen: three green cards to swipe between, with a labelled
 * switcher underneath. Pages are the full screen width so paging snaps cleanly; all
 * three cards stretch to the height of the tallest.
 */
export function HeroCarousel({ pages }: { pages: { key: string; label: string; node: ReactNode }[] }) {
  const t = useTheme();
  // Pages are as wide as the screen's content column (the full screen on phones).
  const { contentWidth: width } = useLayout();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  // Every card is as tall as the tallest one, so the page below doesn't jump while swiping.
  const [tallest, setTallest] = useState(0);
  const go = (i: number) => { setIndex(i); scroll.current?.scrollTo({ x: i * width, animated: true }); };
  return (
    <View style={{ marginHorizontal: -space.l }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
        onScroll={(e) => setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}
        // Room for the cards' shadows, which the scroll view would otherwise clip.
        style={styles.scroller} contentContainerStyle={styles.pages}>
        {pages.map((p, i) => (
          <View key={p.key} style={{ width, paddingHorizontal: space.l }} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
            <View style={{ minHeight: tallest }} onLayout={(e) => { const h = e.nativeEvent.layout.height; setTallest((m) => (h > m ? h : m)); }}>
              {p.node}
            </View>
          </View>
        ))}
      </ScrollView>
      <View role="tablist" style={styles.switcher}>
        {pages.map((p, i) => {
          const on = i === index;
          return (
            <Pressable key={p.key} onPress={() => go(i)} role="tab" aria-selected={on} hitSlop={{ top: 8, bottom: 8 }}
              style={[styles.switch, on && { backgroundColor: t.tintSoft }]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? t.tint : t.secondaryText }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Card 1: free to spend per day through the end of the month, with the last seven days
 * drawn against that number so over-days stand out in amber.
 */
export function FreeCard({ free, days, month }: { free: FreeToSpend; days: { date: string; spent: number }[]; month: string }) {
  const t = useTheme();
  const over = free.leftThisMonth < 0;
  const lastDay = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const top = Math.max(free.perDay * 1.3, ...days.map((d) => d.spent), 1);
  const line = free.perDay / top;
  const overDays = days.filter((d) => d.spent > free.perDay).length;
  const spoken = over
    ? `Over budget by ${$(-free.leftThisMonth)} once bills still to come are counted.`
    : `Free to spend: ${$(free.perDay)} a day through ${shortDate(lastDay)}. ${$(free.spentToday)} spent so far today. ${overDays} of the last 7 days were over that.`;

  return (
    <HeroCard style={{ flex: 1 }}>
      <View accessible aria-label={spoken} style={{ gap: 2 }}>
        <View style={styles.between}>
          <Text style={[styles.heroLabel, { color: t.heroMuted }]}>{over ? 'Over budget by' : 'Free to spend'}</Text>
          {!over && free.spentToday > 0 && (
            <View style={[styles.pill, { backgroundColor: free.leftToday < 0 ? `${t.sun}2E` : `${t.heroText}1F` }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: free.leftToday < 0 ? t.sun : t.heroText }}>
                {free.leftToday < 0 ? `${$(-free.leftToday)} over today` : `${$(free.leftToday)} left today`}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <Display size={68} color={t.heroText} style={{ lineHeight: 72, letterSpacing: -2.4 }}>{$(over ? -free.leftThisMonth : free.perDay)}</Display>
          {!over && (
            <View style={{ paddingBottom: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.heroText }}>{free.daysLeft === 1 ? 'today' : 'a day'}</Text>
              <Text style={{ fontSize: 14, color: t.heroMuted }}>{free.daysLeft === 1 ? 'last day of the month' : `through ${shortDate(lastDay)}`}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.bars}>
          {days.map((d, i) => {
            const today = i === days.length - 1;
            const isOver = d.spent > free.perDay;
            return (
              <View key={d.date} style={styles.barCol}>
                <View style={{ width: '100%', borderRadius: 6, minHeight: 5, height: `${Math.max(0, d.spent) / top * 100}%`, backgroundColor: isOver ? t.sun : today ? t.heroText : t.leaf }} />
              </View>
            );
          })}
        </View>
        {free.perDay > 0 && (
          <>
            <View style={[styles.dash, { bottom: `${line * 100}%`, borderColor: `${t.heroText}6B` }]} />
            <Text style={[styles.dashLabel, { bottom: `${line * 100}%`, color: t.heroMuted }]}>{$(free.perDay)}</Text>
          </>
        )}
      </View>
      <View style={styles.letters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {days.map((d, i) => {
          const today = i === days.length - 1;
          return <Text key={d.date} style={[styles.letter, { color: today ? t.heroText : t.heroMuted, fontWeight: today ? '600' : '500' }]}>{today ? 'Today' : LETTERS[weekday(d.date)]}</Text>;
        })}
      </View>

      <View style={[styles.heroFooter, { borderTopColor: `${t.heroText}33` }]}>
        <View style={{ flex: 1, gap: 2 }} accessible aria-label={`${over ? 'Over' : 'Left'} this month: ${$(Math.abs(free.leftThisMonth))}`}>
          <Text style={{ fontSize: 12, color: t.heroMuted }}>{over ? 'Over this month' : 'Left this month'}</Text>
          <Text style={[styles.stat, { color: t.heroText }]}>{$(Math.abs(free.leftThisMonth))}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: `${t.heroText}33` }]} />
        <View style={{ flex: 1, gap: 2 }} accessible aria-label={`Set aside for bills: ${$(free.billsToCome)}`}>
          <Text style={{ fontSize: 12, color: t.heroMuted }}>Set aside for bills</Text>
          <Text style={[styles.stat, { color: t.heroText }]}>{$(free.billsToCome)}</Text>
        </View>
      </View>
    </HeroCard>
  );
}

/** Card 2: this month against last month, with the So far / Projected switch. */
export function TrendCard({ trend, forecast, month }: { trend: MonthComparison; forecast?: MonthForecast; month: string }) {
  return (
    <HeroCard style={{ flex: 1 }}>
      <SpendingTrend trend={trend} forecast={forecast} month={month} onHero />
    </HeroCard>
  );
}

/**
 * Card 3: the next bills as stops on a path, what's left after each, and where the month
 * is likely to finish. Tapping it opens the full month-ahead screen.
 */
export function AheadCard({ ahead, free, forecast, today }: { ahead: AheadStop[]; free: FreeToSpend; forecast?: MonthForecast; today: number }) {
  const t = useTheme();
  const stops = ahead.slice(0, 4);
  const more = ahead.length - stops.length;
  const finish = forecast ? free.budget - forecast.end.mid : null;
  return (
    <Pressable onPress={() => router.push('/month')} accessibilityRole="button" accessibilityLabel="The month ahead. Opens the full list of upcoming bills." style={{ flex: 1 }}>
      <HeroCard style={{ flex: 1, gap: 0 }}>
        <View style={styles.between}>
          <Text style={[styles.heroLabel, { color: t.heroMuted }]}>Bills still to come</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.heroText, fontVariant: ['tabular-nums'] }}>{$(free.billsToCome)}</Text>
        </View>

        <View style={{ marginTop: 6 }}>
          {stops.length === 0 && <Text style={{ fontSize: 15, color: t.heroText, paddingVertical: 18 }}>Every bill for this month is paid.</Text>}
          {stops.map((s, i) => (
            <View key={s.date} style={[styles.stop, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${t.heroText}29` }]}>
              <View style={{ width: 38, alignItems: 'center' }}>
                <Display size={22} color={t.heroText}>{String(s.day)}</Display>
                <Text style={{ fontSize: 11, fontWeight: '500', color: s.day === today ? t.leaf : t.heroMuted }}>
                  {s.day === today ? 'Today' : WEEKDAYS[weekday(s.date)]}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: t.heroText }}>{s.bills.map((b) => b.vendor).join(', ')}</Text>
                <Text style={{ fontSize: 12, color: t.heroMuted, fontVariant: ['tabular-nums'] }}>{$(s.leftAfter)} left after</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.heroText, fontVariant: ['tabular-nums'] }}>
                {s.bills.length === 1 ? billFigure(s.bills[0]) : $(s.bills.reduce((sum, b) => sum + b.amount, 0))}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.heroFooter, { marginTop: 'auto', alignItems: 'center', borderTopColor: `${t.heroText}33` }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 12, color: t.heroMuted }}>{finish === null ? 'This month' : 'Likely finish'}</Text>
            <Text style={[styles.stat, { color: t.heroText }]}>
              {finish === null ? `${$(free.spent)} of ${$(free.budget)}` : finish >= 0 ? `${$(finish)} under budget` : `${$(-finish)} over budget`}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: t.leaf }}>{more > 0 ? `${more} more` : 'See all'}</Text>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} weight="semibold" tintColor={t.leaf} />
        </View>
      </HeroCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroller: { marginTop: -16, marginBottom: -28 },
  pages: { paddingTop: 16, paddingBottom: 44 },
  switcher: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  switch: { height: 30, paddingHorizontal: 14, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 },
  heroLabel: { fontSize: 14, fontWeight: '500' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  strip: { flex: 1, minHeight: 72, marginTop: 4 },
  bars: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  dash: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(243,247,239,0.42)' },
  dashLabel: { position: 'absolute', right: 0, marginBottom: 4, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  letters: { flexDirection: 'row', gap: 8, marginTop: -4 },
  letter: { flex: 1, textAlign: 'center', fontSize: 11 },
  heroFooter: { flexDirection: 'row', gap: 16, paddingTop: 14, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(243,247,239,0.2)' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(243,247,239,0.2)' },
  stat: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
