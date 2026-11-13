import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Display, space, useTheme } from '@/components/ui';
import { Fonts } from '@/constants/Colors';
import { prefs } from '@/src/lib/prefs';
import { TOUR_SEEN } from '@/src/lib/tour';

/** 0 → 1 over `ms`, eased, restarting whenever `key` changes. Plain frames, so it runs the same on iOS and the web. */
function useTween(key: number, ms = 1600, delay = 250) {
  const [p, setP] = useState(0);
  useEffect(() => {
    setP(0);
    let raf = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const x = Math.min(1, Math.max(0, (Date.now() - start) / ms));
      setP(1 - (1 - x) ** 3);
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, ms, delay]);
  return p;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** The month card: this month's line draws in against last month's, then the projection. */
function MonthArt({ p }: { p: number }) {
  const t = useTheme();
  const pts = [[0, 150], [30, 132], [60, 124], [90, 96], [120, 86], [150, 80], [180, 72]];
  const shown = pts.slice(0, Math.max(2, Math.ceil(p * pts.length)));
  const line = shown.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return (
    <Svg width={280} height={170} viewBox="0 0 280 170">
      <Path d="M0 150 L40 140 L80 126 L120 112 L160 100 L200 84 L240 66 L280 50" stroke={t.secondaryText} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="5 5" fill="none" />
      <Path d={line} stroke={t.tint} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {p > 0.85 && <Path d="M180 72 L215 58 L250 44 L280 34" stroke={t.tint} strokeOpacity={(p - 0.85) / 0.15} strokeWidth={3} strokeDasharray="0.1 8" strokeLinecap="round" fill="none" />}
      <Circle cx={shown.at(-1)![0]} cy={shown.at(-1)![1]} r={6} fill={t.tint} />
    </Svg>
  );
}

/** A bucket's bar fills as the money goes, turning amber once it runs ahead of the tick. */
function BucketArt({ p, over }: { p: number; over?: boolean }) {
  const t = useTheme();
  const used = over ? 0.7 + 0.45 * p : 0.85 * p;
  const tone = used > 1 ? t.red : used > 0.55 ? t.orange : t.green;
  const left = 250 * (1 - used);
  return (
    <View style={{ width: 280, gap: space.m }}>
      <Display size={48} color={used > 1 ? t.red : t.text}>{left < 0 ? `${money(-left)} over` : `${money(left)} left`}</Display>
      <View style={{ height: 16, borderRadius: 8, backgroundColor: t.track, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(1, used) * 100}%`, height: '100%', borderRadius: 8, backgroundColor: tone }} />
      </View>
      <View style={{ position: 'absolute', left: 280 * 0.55 - 1, bottom: -4, width: 2, height: 24, backgroundColor: t.text, opacity: 0.5 }} />
    </View>
  );
}

/** Free to spend: the daily number counts up over a week of bars. */
function FreeArt({ p }: { p: number }) {
  const t = useTheme();
  const bars = [0.5, 0.95, 0.15, 0.08, 0.3, 0.1, 0.05];
  return (
    <View style={{ alignItems: 'center', gap: space.m }}>
      <Display size={64} color={t.tint}>{money(110 * p)}</Display>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 }}>
        {bars.map((b, i) => (
          <View key={i} style={{ width: 22, borderRadius: 6, height: Math.max(4, b * 80 * p), backgroundColor: b > 0.6 ? t.orange : t.green }} />
        ))}
      </View>
    </View>
  );
}

/** A savings goal fills as money goes in. */
function SavingsArt({ p }: { p: number }) {
  const t = useTheme();
  return (
    <View style={{ width: 280, gap: space.m, alignItems: 'center' }}>
      <Display size={48} color={t.text}>{money(4200 * p)}</Display>
      <View style={{ width: '100%', height: 16, borderRadius: 8, backgroundColor: t.track, overflow: 'hidden' }}>
        <View style={{ width: `${70 * p}%`, height: '100%', borderRadius: 8, backgroundColor: t.tint }} />
      </View>
      <Text style={{ color: t.secondaryText, fontSize: 15 }}>of $6,000</Text>
    </View>
  );
}

const STEPS: { title: string; line: string; art: (p: number) => ReactNode }[] = [
  { title: 'Your month', line: 'This month against last. Projected shows where it lands.', art: (p) => <MonthArt p={p} /> },
  { title: 'Your buckets', line: 'The tick is even pace for today. Past it, the bar turns amber.', art: (p) => <BucketArt p={p} /> },
  { title: 'Over the limit', line: 'Red means over. Savings or other buckets can cover it.', art: (p) => <BucketArt p={p} over /> },
  { title: 'Free to spend', line: 'What you can spend each day and still land on budget.', art: (p) => <FreeArt p={p} /> },
  { title: 'Savings', line: 'Goals fill with every deposit.', art: (p) => <SavingsArt p={p} /> },
];

/** A short animated walk through the home screen. Opens once on first launch; replay it from Settings. */
export default function Tour() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const p = useTween(i);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const done = () => { prefs.set(TOUR_SEEN, '1'); router.canGoBack() ? router.back() : router.replace('/'); };

  return (
    <View style={[styles.wrap, { backgroundColor: t.background, paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <View style={styles.dots} accessibilityLabel={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.map((s, n) => <View key={s.title} style={[styles.dot, { backgroundColor: n === i ? t.tint : t.separator, width: n === i ? 22 : 8 }]} />)}
        </View>
        {!last && (
          <Pressable onPress={done} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: t.secondaryText, fontSize: 16, fontWeight: '600' }}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{step.art(p)}</View>

      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{step.title}</Text>
        <Text style={[styles.line, { color: t.secondaryText }]}>{step.line}</Text>
      </View>

      <View style={styles.actions}>
        {i > 0 && <Button variant="secondary" title="Back" onPress={() => setI(i - 1)} style={{ flex: 1 }} />}
        <Button title={last ? 'Start' : 'Next'} onPress={() => (last ? done() : setI(i + 1))} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space.xl, gap: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  art: { height: 300, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  copy: { gap: space.s, alignItems: 'center' },
  title: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, textAlign: 'center' },
  line: { fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 320 },
  actions: { marginTop: 'auto', flexDirection: 'row', gap: space.m, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
