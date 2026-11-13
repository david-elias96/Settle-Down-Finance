import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { GroveTree } from '@/components/GroveTree';
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

/** A bucket's tree: the crown empties as the money goes, turning amber near the limit. */
function GroveArt({ p }: { p: number }) {
  const left = 1 - p * 0.75;
  return <GroveTree size={170} fill={left} tone={left < 0.4 ? 'warn' : 'good'} />;
}

/** Over the limit: the crown is bare and the leaves are on the ground. */
function OverArt({ p }: { p: number }) {
  const t = useTheme();
  return (
    <View>
      <GroveTree size={170} fill={Math.max(0, 0.3 - p)} tone={p > 0.3 ? 'bad' : 'warn'} />
      <Svg width={170} height={187} viewBox="0 0 100 110" style={StyleSheet.absoluteFill} pointerEvents="none">
        {[[40, 40], [62, 50], [50, 30], [30, 58]].map(([x, y], i) => {
          const fall = Math.min(1, Math.max(0, p * 1.4 - i * 0.12));
          return fall > 0 && fall < 1
            ? <Circle key={i} cx={x + Math.sin(fall * 6 + i) * 6} cy={y + fall * (102 - y)} r={3.5} fill={i % 2 ? t.orange : t.red} />
            : null;
        })}
      </Svg>
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

/** A savings goal grows as money goes in. */
function SavingsArt({ p }: { p: number }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ transform: [{ scale: 0.55 + 0.45 * p }] }}>
        <GroveTree size={150} fill={0.15 + 0.85 * p} />
      </View>
      <Display size={30} color={t.text}>{money(4200 * p)}</Display>
    </View>
  );
}

const STEPS: { title: string; line: string; art: (p: number) => ReactNode }[] = [
  { title: 'Your month', line: 'This month against last. Projected shows where it lands.', art: (p) => <MonthArt p={p} /> },
  { title: 'Your grove', line: 'Each bucket is a tree. Leaves fall as you spend.', art: (p) => <GroveArt p={p} /> },
  { title: 'Over the limit', line: 'Bare branches mean that bucket is over.', art: (p) => <OverArt p={p} /> },
  { title: 'Free to spend', line: 'What you can spend each day and still land on budget.', art: (p) => <FreeArt p={p} /> },
  { title: 'Savings grow', line: 'Goals grow with every deposit.', art: (p) => <SavingsArt p={p} /> },
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
