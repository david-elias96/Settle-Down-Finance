import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AiMark, Label, Section, Tag, toneTextColor, useTheme } from '@/components/ui';
import { formatCents, shortDate, type RecapPoint, type WeeklyRecap } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TAG = { good: 'Under pace', warn: 'A bit over', bad: 'Over pace' } as const;

const openPoint = (p: RecapPoint) =>
  p.bucketId ? router.push({ pathname: '/bucket/[id]', params: { id: p.bucketId } })
    : p.transactionId ? router.push({ pathname: '/transaction/[id]', params: { id: p.transactionId } })
    : p.vendor ? router.push({ pathname: '/activity', params: { vendor: p.vendor, at: String(Date.now()) } })
    : null;

/** "Nov 3–9", or "Oct 27–Nov 2" across a month boundary. */
function rangeLabel(start: string, end: string) {
  const a = shortDate(start); const b = shortDate(end);
  return a.split(' ')[0] === b.split(' ')[0] ? `${a}–${b.split(' ')[1]}` : `${a}–${b}`;
}

/**
 * The last 7 days at a glance: everyday spending against the weekly pace, a bar per day,
 * a one-line summary (written by Claude once the backend is connected) and what stood out.
 */
export function WeeklyRecapCard({ recap }: { recap: WeeklyRecap }) {
  const t = useTheme();
  const max = Math.max(1, ...recap.days.map((d) => d.spent), recap.pace / 7);
  const paceLine = recap.pace > 0 ? recap.pace / 7 / max : null;
  const compare = recap.typicalSpent !== null ? `typical week ${$(recap.typicalSpent)}` : `week before ${$(recap.prevSpent)}`;
  const points = recap.points.slice(0, 4);

  return (
    <Section title="This week">
      <View style={styles.top} accessible aria-label={`Weekly recap, ${rangeLabel(recap.start, recap.end)}. ${recap.headline} ${recap.count} purchases, ${compare}.`}>
        <View style={styles.between}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AiMark size={13} />
            <Label secondary style={{ fontSize: 13 }}>Weekly recap · {rangeLabel(recap.start, recap.end)}</Label>
          </View>
        </View>
        <View style={styles.between}>
          <Label style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{$(recap.spent)}</Label>
          {recap.pace > 0 && <Tag tone={recap.tone}>{TAG[recap.tone]}</Tag>}
        </View>
        <Label secondary style={{ fontSize: 13 }}>
          {recap.count} purchase{recap.count === 1 ? '' : 's'} · {compare}
        </Label>

        <View style={styles.chart}>
          {paceLine !== null && (
            <View style={[styles.paceLine, { bottom: 18 + paceLine * 56, borderColor: t.secondaryText }]} />
          )}
          {recap.days.map((d, i) => {
            const isToday = i === recap.days.length - 1;
            const day = new Date(`${d.date}T12:00:00Z`).getUTCDay();
            return (
              <View key={d.date} style={styles.dayCol}>
                <View style={{ height: 56, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                  <View style={{
                    width: '62%', maxWidth: 22, borderRadius: 4, minHeight: d.spent > 0 ? 3 : 2,
                    height: Math.max(0, d.spent) / max * 56,
                    backgroundColor: d.spent > 0 ? t.tint : t.track, opacity: isToday || d.spent <= 0 ? 1 : 0.45,
                  }} />
                </View>
                <Label secondary style={{ fontSize: 11, fontWeight: isToday ? '700' : '400' }}>{DAY_LETTERS[day]}</Label>
              </View>
            );
          })}
        </View>

        {paceLine !== null && (
          <View style={styles.legend}>
            <View style={[styles.legendDash, { borderColor: t.secondaryText }]} />
            <Label secondary style={{ fontSize: 12 }}>Weekly pace {$(recap.pace)} ({$(recap.pace / 7)} a day)</Label>
          </View>
        )}

        <Label style={{ fontSize: 15, lineHeight: 20, marginTop: 8 }}>{recap.headline}</Label>
      </View>

      {points.map((p) => {
        const go = p.bucketId || p.transactionId || p.vendor;
        const body = (
          <View style={[styles.row, { borderTopColor: t.separator }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ fontSize: 16, fontWeight: '600' }}>{p.label}</Label>
              <Label secondary style={{ fontSize: 13, color: p.tone === 'neutral' ? undefined : toneTextColor(t, p.tone) }}>{p.note}</Label>
            </View>
            <Label style={{ fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{p.figure}</Label>
          </View>
        );
        return go ? (
          <Pressable key={p.kind} onPress={() => openPoint(p)} accessibilityRole="button" aria-label={`${p.label}, ${p.figure}, ${p.note}`}>{body}</Pressable>
        ) : <View key={p.kind} accessible aria-label={`${p.label}, ${p.figure}, ${p.note}`}>{body}</View>;
      })}

      <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'How did my spending go this week?' } })} accessibilityRole="button">
        <View style={[styles.row, { borderTopColor: t.separator, paddingVertical: 13 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AiMark size={15} />
            <Label style={{ color: t.tint, fontSize: 15 }}>Ask about my week</Label>
          </View>
        </View>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingVertical: 14, gap: 2 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chart: { flexDirection: 'row', marginTop: 12, height: 74 },
  dayCol: { flex: 1, alignItems: 'center', gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  legendDash: { width: 16, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  paceLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
