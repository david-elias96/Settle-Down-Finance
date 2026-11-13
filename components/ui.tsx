import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scrollShift } from '@/src/lib/keyboard';
import { columnStyle, useLayout } from '@/src/lib/layout';
import Colors, { Fonts, Shape } from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

export const useTheme = () => Colors[useColorScheme()];
export type Theme = ReturnType<typeof useTheme>;

/** Spacing scale. Screens use a 16pt gutter; cards pad 16; sections sit 24 apart. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { card: Shape.card, control: 14, pill: 999 } as const;

/**
 * A scrolling screen on the cream background. Tab screens pass `title` to draw their own
 * large serif title (with an optional `action` such as the Settings gear) instead of a
 * navigation bar; pushed screens keep the native header and leave `title` out.
 */
export function Screen({ children, title, eyebrow, action, keyboardDone }: {
  children: ReactNode; title?: string; eyebrow?: string; action?: ReactNode;
  /**
   * For screens with text fields: show a Done bar on top of the keyboard (iOS number pads have
   * no Return key) and scroll so the field being typed in sits just above it.
   */
  keyboardDone?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Floating tab bar: leave room so the last card scrolls clear of it.
  const tabBar = useContext(BottomTabBarHeightContext);
  const scrollRef = useRef<{ scrollTo(o: { y: number; animated?: boolean }): void } | null>(null);
  const offset = useRef(0);
  const keyboard = useKeyboard(!!keyboardDone);
  const { wide } = useLayout();

  // Each time the keyboard appears or changes (including moving to another field), bring the
  // focused field, and a little room for the button under it, above the keyboard and Done bar.
  useEffect(() => {
    if (keyboard.height == null) return;
    const timer = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as { measureInWindow?(cb: (x: number, y: number, w: number, h: number) => void): void } | null;
      input?.measureInWindow?.((_x, y, _w, h) => {
        const visibleTop = insets.top + 56;
        const visibleBottom = Dimensions.get('window').height - keyboard.height! - DONE_BAR_HEIGHT - space.m;
        const shift = scrollShift({ fieldTop: y, fieldBottom: y + h, visibleTop, visibleBottom, extraBelow: 72 });
        if (shift !== 0) scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + shift), animated: true });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [keyboard.height, keyboard.changes]); // eslint-disable-line react-hooks/exhaustive-deps

  const keyboardRoom = keyboard.height != null ? keyboard.height + DONE_BAR_HEIGHT : 0;
  const scroll = (
    <ScrollView ref={scrollRef as never} style={{ backgroundColor: t.background }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
      contentInsetAdjustmentBehavior={title ? 'never' : 'automatic'}
      contentContainerStyle={[{ paddingHorizontal: space.l, paddingTop: title ? insets.top + (wide ? space.xxl : space.l) : (wide ? space.xl : space.l), paddingBottom: Math.max((tabBar ?? 0) + space.xl, keyboardRoom + space.xl), gap: space.xl }, columnStyle(wide)]}>
      {title && (
        <View style={styles.titleRow}>
          <View style={{ flexShrink: 1 }}>
            {eyebrow && <Text style={[styles.eyebrow, { color: t.secondaryText }]}>{eyebrow}</Text>}
            <Text accessibilityRole="header" style={[styles.largeTitle, { color: t.text }]} numberOfLines={2}>{title}</Text>
          </View>
          {action}
        </View>
      )}
      {children}
    </ScrollView>
  );
  if (!keyboardDone) return scroll;
  return <View style={{ flex: 1, backgroundColor: t.background }}>{scroll}<KeyboardDone height={keyboard.height} /></View>;
}

/** Serif display text for big numbers and headings. */
export function Display({ children, size = 34, color, style, ...rest }: { children: ReactNode; size?: number; color?: string; style?: TextStyle } & Omit<TextProps, 'style'>) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ fontFamily: Fonts.display, fontSize: size, lineHeight: Math.round(size * 1.12), letterSpacing: -size * 0.02, color: color ?? t.text, fontVariant: ['tabular-nums'] }, style]}>
      {children}
    </Text>
  );
}

/** White card with a soft shadow. The inner view clips rows to the rounded corners. */
export function Card({ children, style, padded }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <View style={[styles.cardShadow, { backgroundColor: t.card, boxShadow: dark || Shape.edge !== 'shadow' ? undefined : `0 1px 2px ${t.shadow}, 0 8px 24px ${t.shadow}` }, (dark || Shape.edge === 'border') && { borderWidth: Shape.edge === 'border' ? 1 : StyleSheet.hairlineWidth, borderColor: t.separator }, style]}>
      <View style={[styles.cardClip, padded && { padding: space.l }]}>{children}</View>
    </View>
  );
}

/** True on iOS 26 and later, where the system's liquid glass material exists. */
const LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * Liquid glass, for the controls that float above the content: the tab bar, the round
 * button in a title row, sheets. Content cards stay solid paper so text is easy to read.
 * On iOS 26 this is the system material (it bends and tints what scrolls underneath).
 * Elsewhere it is a frosted stand-in: blurred on the web, nearly solid on older phones.
 */
export function Glass({ children, style, corner = radius.pill, interactive, lift = true }: {
  children?: ReactNode; style?: ViewStyle; corner?: number; interactive?: boolean; lift?: boolean;
}) {
  const t = useTheme();
  const scheme = useColorScheme();
  if (LIQUID_GLASS) {
    return <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={scheme} style={[{ borderRadius: corner }, style]}>{children}</GlassView>;
  }
  const web = Platform.OS === 'web';
  const frost = web ? ({ backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as ViewStyle) : null;
  return (
    <View style={[{
      borderRadius: corner, backgroundColor: web ? t.glass : t.glassSolid, borderWidth: StyleSheet.hairlineWidth, borderColor: t.glassEdge,
      boxShadow: `inset 0 1px 0 ${t.glassEdge}${lift ? `, 0 10px 30px ${t.glassShadow}` : `, 0 2px 10px ${t.shadow}`}`,
    }, frost, style]}>{children}</View>
  );
}

/**
 * A titled card. Titles are serif headings; `quiet` makes the title a small label instead,
 * for long lists grouped by day where a heading on every group would shout.
 */
export function Section({ title, footer, action, quiet, children }: { title?: string; footer?: string; action?: ReactNode; quiet?: boolean; children: ReactNode }) {
  const t = useTheme();
  return (
    <View>
      {title && (
        <View style={styles.sectionHead}>
          <Text accessibilityRole="header" style={quiet ? [styles.quietTitle, { color: t.secondaryText }] : Shape.section === 'label' ? [styles.labelTitle, { color: t.secondaryText }] : [styles.sectionTitle, { color: t.text }]}>{Shape.section === 'label' && !quiet ? title.toUpperCase() : title}</Text>
          {action}
        </View>
      )}
      <Card>{children}</Card>
      {footer && <Text style={[styles.footer, { color: t.secondaryText }]}>{footer}</Text>}
    </View>
  );
}

/** Deep green card at the top of a tab: the one number that matters on that screen. */
export function HeroCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: t.hero, boxShadow: Shape.edge === 'shadow' ? `inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 32px ${(Shape.gradient?.[1] ?? t.hero)}47` : undefined }, Shape.gradient && { overflow: 'hidden' }, style]}>
      {Shape.gradient && (
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
          <Defs><LinearGradient id="heroGrad" x1="0" y1="0" x2="0.35" y2="1">
            {Shape.gradient.map((c, i) => <Stop key={c} offset={i / (Shape.gradient!.length - 1)} stopColor={c} />)}
          </LinearGradient></Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#heroGrad)" />
        </Svg>
      )}
      {children}
    </View>
  );
}

/**
 * The app's buttons. `primary` is a filled green pill for the main action on a screen,
 * `secondary` a soft green pill, `destructive` a filled red one, `plain` a text button
 * that still has a 44pt target.
 */
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, ai, small, style, textColor, accessibilityLabel }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'destructive' | 'plain'; small?: boolean;
  icon?: SymbolViewProps['name']; disabled?: boolean; loading?: boolean; ai?: boolean; style?: ViewStyle; textColor?: string; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.tint : variant === 'destructive' ? t.red : variant === 'secondary' ? t.tintSoft : 'transparent';
  const fg = textColor ?? (variant === 'primary' ? t.onTint : variant === 'destructive' ? '#FFFFFF' : t.tint);
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={small ? 6 : undefined}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: off && variant !== 'plain' ? t.track : bg, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {loading ? <ActivityIndicator color={t.secondaryText} /> : (
        <>
          {ai ? <AiMark size={16} color={off ? t.secondaryText : fg} /> : icon ? <SymbolView name={icon} size={18} tintColor={off ? t.secondaryText : fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: off ? t.secondaryText : fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Round glass button for a screen's title row, e.g. the Settings gear. */
export function IconButton({ icon, label, onPress }: { icon: SymbolViewProps['name']; label: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Glass interactive lift={false} style={styles.iconButton}>
        <SymbolView name={icon} size={20} tintColor={Shape.tab === 'solid' ? t.tint : t.tabIconSelected} />
      </Glass>
    </Pressable>
  );
}

export function Row({ icon, title, subtitle, right, children, last }: {
  icon?: SymbolViewProps['name']; title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; last?: boolean;
}) {
  const t = useTheme();
  return (
    <View accessible={!right && !children} style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <View style={styles.rowTop}>
        {icon && <IconChip icon={icon} />}
        <View style={{ flex: 1 }}>
          <Label style={{ fontSize: 17 }}>{title}</Label>
          {subtitle && <Label secondary style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</Label>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Soft rounded square holding a symbol, used as the leading mark on rows. */
export function IconChip({ icon, tone, size = 40 }: { icon: SymbolViewProps['name']; tone?: Tone; size?: number }) {
  const t = useTheme();
  const c = tone && tone !== 'neutral' ? toneColor(t, tone) : t.tint;
  return (
    <View style={{ width: size, height: size, borderRadius: Shape.chip === 'soft' ? size * 0.32 : size / 2, backgroundColor: Shape.chip === 'outline' ? 'transparent' : tone && tone !== 'neutral' ? `${c}${Shape.chip === 'circle' ? '2E' : '1F'}` : t.tintSoft, borderWidth: Shape.chip === 'outline' ? 1 : 0, borderColor: tone && tone !== 'neutral' ? `${c}66` : t.separator, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={icon} size={size * 0.5} tintColor={tone && tone !== 'neutral' ? toneTextColor(t, tone) : t.tint} />
    </View>
  );
}

export function Label({ children, secondary, style, numberOfLines }: { children: ReactNode; secondary?: boolean; style?: TextStyle; numberOfLines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: secondary ? t.secondaryText : t.text }, style]}>{children}</Text>;
}

export function ProgressBar({ ratio }: { ratio: number }) {
  const t = useTheme();
  const color = ratio > 1 ? t.red : ratio > 0.85 ? t.orange : t.green;
  return (
    <View style={[styles.track, { backgroundColor: t.track }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      <View style={{ width: `${Math.min(1, ratio) * 100}%`, backgroundColor: color, height: '100%', borderRadius: 4 }} />
    </View>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export function toneColor(t: Theme, tone: Tone) {
  return tone === 'good' ? t.green : tone === 'warn' ? t.orange : tone === 'bad' ? t.red : t.secondaryText;
}

/** Same tones, in the darker shades that are readable as text. */
export function toneTextColor(t: Theme, tone: Tone) {
  return tone === 'good' ? t.greenText : tone === 'warn' ? t.orangeText : tone === 'bad' ? t.redText : t.secondaryText;
}

/** The word at the right end of a tappable row ("Invite", "Unlink", "Delete"), as a soft capsule. */
export function Pill({ children, tone }: { children: string; tone?: 'bad' }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: tone === 'bad' ? `${t.red}1F` : t.tintSoft }]}>
      <Text style={{ color: tone === 'bad' ? t.redText : t.tint, fontSize: 14, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

/** Small colored status pill: "Over budget", "Heading over", "On track". */
export function Tag({ tone, children }: { tone: Tone; children: string }) {
  const t = useTheme();
  const c = toneColor(t, tone);
  return (
    <View style={[styles.tag, { backgroundColor: `${c}1F` }]}>
      <Text style={{ color: toneTextColor(t, tone), fontSize: 12, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

/**
 * The app's standard list row: name and one short line on the left, the key number and
 * an optional tag on the right, optional bar underneath. Used on every screen.
 */
export function ListRow({ leading, title, note, figure, figureTone, tag, bar, onPress, last, chevron = true, wrapNote }: {
  leading?: ReactNode; title: string; note?: string | null; figure?: string; figureTone?: Tone;
  tag?: { tone: Tone; text: string } | null; bar?: ReactNode; onPress?: () => void; last?: boolean;
  /** Tappable rows show a chevron; pass false for rows that toggle something in place. */
  chevron?: boolean;
  /** Let a longer note run to two lines instead of cutting it off. */
  wrapNote?: boolean;
}) {
  const t = useTheme();
  const spoken = [title, figure?.replace(' / ', ' of '), note, tag?.text].filter(Boolean).join(', ');
  const body = (pressed = false) => (
    <View accessible={!onPress} aria-label={spoken} style={[styles.listRow, pressed && { backgroundColor: t.track }]}>
      <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
        {leading}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.between}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{title}</Text>
            {figure ? <Text style={{ color: figureTone && figureTone !== 'neutral' ? toneTextColor(t, figureTone) : t.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{figure}</Text> : null}
          </View>
          {bar ? <View style={{ paddingVertical: 3 }}>{bar}</View> : null}
          {(note || tag) ? (
            <View style={styles.between}>
              <Text style={{ color: t.secondaryText, fontSize: 13, lineHeight: 18, flexShrink: 1 }} numberOfLines={wrapNote ? 2 : 1}>{note ?? ''}</Text>
              {tag ? <Tag tone={tag.tone}>{tag.text}</Tag> : null}
            </View>
          ) : null}
        </View>
        {onPress && chevron ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} weight="semibold" tintColor={t.secondaryText} style={{ opacity: 0.6 }} /> : null}
      </View>
      {!last && <View style={[styles.rule, { backgroundColor: t.separator, left: leading ? space.l + 40 + space.m : space.l }]} />}
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" aria-label={spoken}>{({ pressed }) => body(pressed)}</Pressable>
    : body();
}

/** A big number with a small caption, for rows of 2-3 stats. */
export function StatTile({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.tile}>
        <Text style={{ color: t.secondaryText, fontSize: 13 }}>{label}</Text>
        <Display size={22} color={tone && tone !== 'neutral' ? toneTextColor(t, tone) : t.text} numberOfLines={1} adjustsFontSizeToFit>{value}</Display>
      </View>
    </Card>
  );
}

/** Progress bar with an optional tick for where an even pace would be today. */
export function PaceBar({ ratio, tone, paceAt, track }: { ratio: number; tone: Tone; paceAt?: number; track?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      <View style={[styles.track, { backgroundColor: track ?? t.track }]}>
        <View style={{ width: `${Math.min(1, ratio) * 100}%`, backgroundColor: toneColor(t, tone), height: '100%', borderRadius: 3 }} />
      </View>
      {paceAt != null && (
        <View style={{ position: 'absolute', left: `${Math.min(1, paceAt) * 100}%`, top: -3, width: 2, height: 12, marginLeft: -1, borderRadius: 1, backgroundColor: t.text, opacity: 0.55 }} />
      )}
    </View>
  );
}

/** Marks a feature powered by Claude. Decorative: the button's own label says what it does. */
export function AiMark({ size = 14, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={size} tintColor={color ?? t.tint} />
    </View>
  );
}

/**
 * A likely range on one line: a bar from low to high, a dot at the most likely value,
 * and an optional tick for a reference such as last month.
 */
export function RangeBar({ low, mid, high, marker, markerLabel, tone, format, onHero }: {
  low: number; mid: number; high: number; marker?: number; markerLabel?: string; tone: Tone; format: (n: number) => string; onHero?: boolean;
}) {
  const t = useTheme();
  const min = Math.min(low, marker ?? low); const max = Math.max(high, marker ?? high);
  const pad = (max - min) * 0.08 || 1;
  const at = (v: number) => `${((v - (min - pad)) / (max - min + 2 * pad)) * 100}%` as const;
  const c = onHero ? (tone === 'good' ? t.leaf : tone === 'bad' ? '#FF9C86' : t.sun) : toneColor(t, tone);
  const muted = onHero ? t.heroMuted : t.secondaryText;
  return (
    <View style={{ gap: 6 }} accessible aria-label={`Likely between ${format(low)} and ${format(high)}${marker != null ? `. ${markerLabel ?? 'Reference'}: ${format(marker)}` : ''}`}>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: onHero ? `${t.heroText}29` : t.track }} />
        <View style={{ position: 'absolute', left: at(low), width: `${((high - low) / (max - min + 2 * pad)) * 100}%`, height: 8, borderRadius: 4, backgroundColor: `${c}55` }} />
        {marker != null && <View style={{ position: 'absolute', left: at(marker), marginLeft: -1, width: 2, height: 14, borderRadius: 1, backgroundColor: muted }} />}
        <View style={{ position: 'absolute', left: at(mid), marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: c, borderWidth: 2, borderColor: onHero ? t.hero : t.card }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>Likely {format(low)}–{format(high)}</Text>
        {marker != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 2, height: 10, borderRadius: 1, backgroundColor: muted }} />
            <Text style={{ color: muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{markerLabel} {format(marker)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Two-option switch, e.g. "So far / Projected". */
export function Segmented<T extends string>({ options, value, onChange, onHero }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; onHero?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: onHero ? `${t.heroText}1F` : t.track }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && { backgroundColor: onHero ? t.heroText : t.card }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? (onHero ? t.hero : t.text) : onHero ? t.heroMuted : t.secondaryText }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.m, paddingHorizontal: space.xs, marginBottom: -space.s },
  eyebrow: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  largeTitle: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.64 },
  listRow: { paddingVertical: 13, paddingHorizontal: space.l },
  rule: { position: 'absolute', right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s },
  tile: { padding: space.m + 2, gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: space.xs, marginBottom: space.s + 2 },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },
  labelTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
  quietTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  footer: { fontSize: 13, lineHeight: 18, marginHorizontal: space.xs, marginTop: space.s },
  cardShadow: { borderRadius: radius.card },
  cardClip: { borderRadius: radius.card, overflow: 'hidden' },
  hero: { borderRadius: Shape.hero, padding: 20, gap: 12 },
  row: { paddingVertical: 13, paddingHorizontal: space.l, gap: space.s },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  pill: { paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  button: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSmall: { minHeight: 34, paddingHorizontal: 14, gap: 6 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
});

/** The gear in each tab's title row. Settings lives here so the tab bar has room for Subscriptions. */
export function SettingsButton() {
  return <IconButton icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />;
}

/** Material names for the bucket icons (stored as SF Symbol names), for Android and web. */
const MATERIAL: Record<string, string> = {
  'house.fill': 'home', 'cart.fill': 'shopping_cart', 'fork.knife': 'restaurant', 'car.fill': 'directions_car',
  'cross.case.fill': 'medical_services', 'figure.and.child.holdinghands': 'family_restroom', 'bag.fill': 'shopping_bag',
  'tv.fill': 'tv', 'sparkles': 'spa', 'doc.text.fill': 'receipt_long', 'questionmark.circle.fill': 'more_horiz', 'star.fill': 'star',
};

/** A bucket's icon as a symbol name for every platform. */
export function bucketSymbol(icon?: string): SymbolViewProps['name'] {
  const m = (icon && MATERIAL[icon]) || 'category';
  return { ios: (icon ?? 'circle') as never, android: m as never, web: m as never };
}

/** Leading chip for a bucket row, tinted by how the bucket is doing. */
export function BucketChip({ icon, tone }: { icon?: string; tone?: Tone }) {
  return <IconChip icon={bucketSymbol(icon)} tone={tone === 'good' ? undefined : tone} />;
}

/** The heading and one short paragraph at the top of a setup screen. */
export function Intro({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.s, paddingHorizontal: space.xs }}>
      <Text accessibilityRole="header" style={{ fontFamily: Fonts.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.5, color: t.text }}>{title}</Text>
      {children ? <Text style={{ fontSize: 16, lineHeight: 23, color: t.secondaryText }}>{children}</Text> : null}
    </View>
  );
}

/** A short notice in a card: something isn't available yet, or a list is empty. */
export function Notice({ icon, title, children }: { icon?: SymbolViewProps['name']; title: string; children?: string }) {
  return (
    <Card>
      <ListRow title={title} note={null} last leading={<IconChip icon={icon ?? { ios: 'info.circle.fill', android: 'info', web: 'info' }} />} />
      {children ? <View style={{ paddingHorizontal: space.l, paddingBottom: space.l, marginTop: -space.xs }}><Label secondary style={{ fontSize: 14, lineHeight: 20 }}>{children}</Label></View> : null}
    </Card>
  );
}

/** A text field that sits in a card row, with a visible label above the value. */
export const fieldStyle = { paddingHorizontal: space.l, paddingVertical: 15, fontSize: 17 } as const;

const DONE_BAR_HEIGHT = 46;

/** The keyboard's height while it's up (null when down), and a count that ticks on every show/change. */
function useKeyboard(enabled: boolean) {
  const [state, setState] = useState<{ height: number | null; changes: number }>({ height: null, changes: 0 });
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setState((s) => ({ height: e.endCoordinates.height, changes: s.changes + 1 })));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setState((s) => ({ height: null, changes: s.changes })));
    return () => { show.remove(); hide.remove(); };
  }, [enabled]);
  return state;
}

/** A Done bar that sits right on top of the keyboard and closes it. Use Screen's `keyboardDone`. */
function KeyboardDone({ height }: { height: number | null }) {
  const t = useTheme();
  if (height == null) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: height, height: DONE_BAR_HEIGHT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
      <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done, close keyboard" hitSlop={8}
        style={({ pressed }) => ({ paddingHorizontal: space.l, paddingVertical: 11, opacity: pressed ? 0.5 : 1 })}>
        <Text style={{ color: t.tint, fontSize: 17, fontWeight: '600' }}>Done</Text>
      </Pressable>
    </View>
  );
}

/** A screen for something that's gone (deleted, or an old link), with a way back instead of a dead end. */
export function Gone({ title, children }: { title: string; children?: string }) {
  return (
    <Screen>
      <Notice title={title} icon={{ ios: 'questionmark.folder', android: 'help', web: 'help' }}>{children}</Notice>
      <Button title="Back to my budget" onPress={() => router.replace('/')} />
    </Screen>
  );
}
