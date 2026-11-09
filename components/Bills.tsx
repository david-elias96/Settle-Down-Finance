import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Label, Section, toneTextColor, useTheme } from '@/components/ui';
import { billFigure, billNote, formatCents, type Bill, type BillsOutlook } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });

/**
 * This month's bills: what's still to come (with due dates and, for bills that vary, the
 * likely range), then the ones already paid, folded away.
 */
export function BillsCard({ outlook }: { outlook: BillsOutlook }) {
  const t = useTheme();
  const [showPaid, setShowPaid] = useState(false);
  if (!outlook.bills.length) return null;
  const toCome = outlook.bills.filter((b) => b.status !== 'paid');
  const paid = outlook.bills.filter((b) => b.status === 'paid').sort((a, b) => a.paid!.date.localeCompare(b.paid!.date));
  const sep = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator };

  const Row = ({ b }: { b: Bill }) => {
    const note = billNote(b);
    const body = (
      <View style={[styles.row, sep]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label style={{ fontSize: 16, fontWeight: '600' }}>{b.vendor}</Label>
          <Label secondary style={{ fontSize: 13, color: b.status === 'late' ? toneTextColor(t, 'warn') : undefined }}>{note}</Label>
        </View>
        <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{billFigure(b)}</Label>
      </View>
    );
    return b.paid ? (
      <Pressable onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: b.paid!.transactionId } })}
        accessibilityRole="button" aria-label={`${b.vendor}, ${billFigure(b)}, ${note}`}>{body}</Pressable>
    ) : <View accessible aria-label={`${b.vendor}, ${billFigure(b).replace('–', ' to ')}, ${note}`}>{body}</View>;
  };

  return (
    <Section title="Bills this month">
      <View style={styles.top} accessible aria-label={`${$(outlook.toCome)} in bills still to come this month, ${$(outlook.paid)} paid so far.`}>
        <View style={{ flex: 1 }}>
          <Label secondary style={{ fontSize: 13 }}>Still to come</Label>
          <Label style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{$(outlook.toCome)}</Label>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Label secondary style={{ fontSize: 13 }}>Paid so far</Label>
          <Label style={{ fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{$(outlook.paid)}</Label>
        </View>
      </View>

      {toCome.map((b) => <Row key={b.key} b={b} />)}

      {paid.length > 0 && (
        <Pressable onPress={() => setShowPaid((s) => !s)} accessibilityRole="button" aria-expanded={showPaid}
          style={[styles.row, sep, { paddingVertical: 13 }]}>
          <Label style={{ color: t.tint, fontSize: 15, flex: 1 }}>{showPaid ? 'Hide paid bills' : `Show ${paid.length} paid bill${paid.length === 1 ? '' : 's'}`}</Label>
        </Pressable>
      )}
      {showPaid && paid.map((b) => <Row key={b.key} b={b} />)}
    </Section>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
