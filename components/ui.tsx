import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
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

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, marginLeft: 16, marginBottom: 6 },
  footer: { fontSize: 13, marginHorizontal: 16, marginTop: 6 },
  card: { borderRadius: 12, overflow: 'hidden' },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
