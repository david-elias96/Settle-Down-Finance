import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

export const useTheme = () => Colors[useColorScheme()];

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 20 }}>
      {children}
    </ScrollView>
  );
}

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View>
      {title && <Text style={[styles.sectionTitle, { color: t.secondaryText }]}>{title.toUpperCase()}</Text>}
      <View style={[styles.card, { backgroundColor: t.card }]}>{children}</View>
      {footer && <Text style={[styles.footer, { color: t.secondaryText }]}>{footer}</Text>}
    </View>
  );
}

export function Row({ icon, title, subtitle, right, children, last }: {
  icon?: SymbolViewProps['name']; title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; last?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <View style={styles.rowTop}>
        {icon && <SymbolView name={icon} size={22} tintColor={t.tint} style={{ width: 28 }} />}
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

export function Label({ children, secondary, style }: { children: ReactNode; secondary?: boolean; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[{ color: secondary ? t.secondaryText : t.text }, style]}>{children}</Text>;
}

export function ProgressBar({ ratio }: { ratio: number }) {
  const t = useTheme();
  const color = ratio > 1 ? t.red : ratio > 0.85 ? t.orange : t.green;
  return (
    <View style={[styles.track, { backgroundColor: t.track }]}>
      <View style={{ width: `${Math.min(1, ratio) * 100}%`, backgroundColor: color, height: '100%', borderRadius: 4 }} />
    </View>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export function toneColor(t: ReturnType<typeof useTheme>, tone: Tone) {
  return tone === 'good' ? t.green : tone === 'warn' ? t.orange : tone === 'bad' ? t.red : t.secondaryText;
}

/** Small colored status pill: "Over budget", "Heading over", "On track". */
export function Tag({ tone, children }: { tone: Tone; children: string }) {
  const t = useTheme();
  const c = toneColor(t, tone);
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${c}1F` }}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

/**
 * The app's standard list row: name and one short line on the left, the key number and
 * an optional tag on the right, optional bar underneath. Used on every screen.
 */
export function ListRow({ leading, title, note, figure, figureTone, tag, bar, onPress, last }: {
  leading?: ReactNode; title: string; note?: string | null; figure?: string; figureTone?: Tone;
  tag?: { tone: Tone; text: string } | null; bar?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.listRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {leading}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.between}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{title}</Text>
            {figure ? <Text style={{ color: figureTone && figureTone !== 'neutral' ? toneColor(t, figureTone) : t.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{figure}</Text> : null}
          </View>
          {(note || tag) ? (
            <View style={styles.between}>
              <Text style={{ color: t.secondaryText, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{note ?? ''}</Text>
              {tag ? <Tag tone={tag.tone}>{tag.text}</Tag> : null}
            </View>
          ) : null}
        </View>
      </View>
      {bar}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

/** A big number with a small caption, for rows of 2-3 stats. */
export function StatTile({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.card }]}>
      <Text style={{ color: t.secondaryText, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: tone && tone !== 'neutral' ? toneColor(t, tone) : t.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/** Progress bar with an optional tick for where an even pace would be today. */
export function PaceBar({ ratio, tone, paceAt }: { ratio: number; tone: Tone; paceAt?: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 8, marginTop: 8 }}>
      <View style={[styles.track, { backgroundColor: t.track }]}>
        <View style={{ width: `${Math.min(1, ratio) * 100}%`, backgroundColor: toneColor(t, tone), height: '100%', borderRadius: 4 }} />
      </View>
      {paceAt != null && (
        <View style={{ position: 'absolute', left: `${Math.min(1, paceAt) * 100}%`, top: -3, width: 2, height: 14, marginLeft: -1, borderRadius: 1, backgroundColor: t.text, opacity: 0.6 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listRow: { paddingVertical: 12, paddingHorizontal: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tile: { flex: 1, borderRadius: 12, padding: 12, gap: 2 },
  sectionTitle: { fontSize: 13, marginLeft: 16, marginBottom: 6 },
  footer: { fontSize: 13, marginHorizontal: 16, marginTop: 6 },
  card: { borderRadius: 12, overflow: 'hidden' },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
