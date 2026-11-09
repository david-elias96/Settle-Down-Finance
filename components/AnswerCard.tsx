import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Label, useTheme } from '@/components/ui';
import type { AnswerTone, AskAnswer, Bucket } from '@/src/domain';

/** An Ask answer laid out for skimming: headline, rows with figures, then one tip. */
export function AnswerCard({ answer, buckets, preview }: { answer: AskAnswer; buckets: Bucket[]; preview?: boolean }) {
  const t = useTheme();
  const toneColor: Record<AnswerTone, string> = { good: t.green, warn: t.orange, bad: t.red, neutral: t.secondaryText };
  const bucketId = (name?: string | null) => (name ? buckets.find((b) => b.name.toLowerCase() === name.toLowerCase())?.id : undefined);

  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      <Label style={styles.headline}>{answer.headline}</Label>

      {answer.rows.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {answer.rowsTitle ? <Label secondary style={styles.rowsTitle}>{answer.rowsTitle.toUpperCase()}</Label> : null}
          {answer.rows.map((r, i) => {
            const id = bucketId(r.bucket);
            const row = (
              <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }]}>
                <View style={[styles.dot, { backgroundColor: toneColor[r.tone ?? 'neutral'] }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.rowTop}>
                    <Label style={styles.label}>{r.label}</Label>
                    <Label style={{ ...styles.value, ...(r.tone === 'bad' ? { color: t.redText } : null) }}>{r.value}</Label>
                    {id ? <Label secondary style={{ fontSize: 15 }}>›</Label> : null}
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
        <View style={[styles.tip, { backgroundColor: t.background }]}>
          <Label style={{ fontSize: 14 }}>💡</Label>
          <Label style={{ fontSize: 14, flex: 1, lineHeight: 19 }}>{answer.tip}</Label>
        </View>
      ) : null}

      {preview && <Label secondary style={{ fontSize: 11, marginTop: 10 }}>Preview from sample data</Label>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, alignSelf: 'stretch' },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
  rowsTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '500', flex: 1 },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 13, lineHeight: 17 },
  tip: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10, marginTop: 12 },
});
