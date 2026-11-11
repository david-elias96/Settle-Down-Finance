import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Label, useTheme } from '@/components/ui';
import { Fonts } from '@/constants/Colors';
import type { AnswerTone, AskAnswer, Bucket } from '@/src/domain';

/** An Ask answer laid out for skimming: headline, rows with figures, then one tip. */
export function AnswerCard({ answer, buckets, preview }: { answer: AskAnswer; buckets: Bucket[]; preview?: boolean }) {
  const t = useTheme();
  const toneColor: Record<AnswerTone, string> = { good: t.green, warn: t.orange, bad: t.red, neutral: t.secondaryText };
  const bucketId = (name?: string | null) => (name ? buckets.find((b) => b.name.toLowerCase() === name.toLowerCase())?.id : undefined);

  return (
    <Card padded style={{ alignSelf: 'stretch' }}>
      <Label style={styles.headline}>{answer.headline}</Label>

      {answer.rows.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {answer.rowsTitle ? <Label secondary style={styles.rowsTitle}>{answer.rowsTitle}</Label> : null}
          {answer.rows.map((r, i) => {
            const id = bucketId(r.bucket);
            const row = (
              <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}>
                <View style={[styles.dot, { backgroundColor: toneColor[r.tone ?? 'neutral'] }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.rowTop}>
                    <Label style={styles.label}>{r.label}</Label>
                    <Label style={{ ...styles.value, ...(r.tone === 'bad' ? { color: t.redText } : null) }}>{r.value}</Label>
                    {id ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} weight="semibold" tintColor={t.secondaryText} style={{ opacity: 0.6 }} /> : null}
                  </View>
                  {r.detail ? <Label secondary style={styles.detail}>{r.detail}</Label> : null}
                </View>
              </View>
            );
            return id ? (
              <Pressable key={i} accessibilityRole="button" onPress={() => router.push({ pathname: '/bucket/[id]', params: { id } })}>{row}</Pressable>
            ) : <View key={i}>{row}</View>;
          })}
        </View>
      )}

      {answer.tip ? (
        <View style={[styles.tip, { backgroundColor: t.tintSoft }]}>
          <SymbolView name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }} size={16} tintColor={t.tint} style={{ marginTop: 1 }} />
          <Label style={{ fontSize: 14, flex: 1, lineHeight: 19 }}>{answer.tip}</Label>
        </View>
      ) : null}

      {preview && <Label secondary style={{ fontSize: 12, marginTop: 10 }}>Preview from sample data</Label>}
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: Fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  rowsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '500', flex: 1 },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 13, lineHeight: 17 },
  tip: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, marginTop: 12 },
});
