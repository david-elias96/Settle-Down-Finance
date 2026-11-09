import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AiMark, Label, ListRow, Row, Screen, Section, StatTile, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { cancelRoute, findSubscriptions, formatCents, shortDate, type Subscription } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${todayIso()}T12:00:00Z`)) / 86400000);

/**
 * Every recurring charge in one place: what it costs a month and a year, what's coming
 * up next, which prices went up, and a way to cancel each with AI.
 */
export default function SubscriptionsScreen() {
  const t = useTheme();
  const { transactions } = useBudget();
  const subs = findSubscriptions(transactions);
  const monthly = subs.reduce((s, x) => s + x.amount, 0);
  const raised = subs.filter((s) => s.amount > s.previousAmount);
  const next = [...subs].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  const soon = subs.filter((s) => { const n = daysUntil(s.nextDate); return n >= 0 && n <= 7; }).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <Screen>
      <View accessible accessibilityRole="header" aria-label={`Subscriptions: ${formatCents(monthly)} a month, ${$(monthly * 12)} a year, ${subs.length} active`}
        style={[styles.hero, { backgroundColor: t.card }]}>
        <Label secondary style={{ fontSize: 13 }}>You pay for subscriptions</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Label style={{ fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatCents(monthly)}</Label>
          <Label secondary style={{ fontSize: 17 }}>a month</Label>
        </View>
        <Label secondary style={{ fontSize: 15 }}>{$(monthly * 12)} a year</Label>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile label="Active" value={String(subs.length)} />
        <StatTile label="Price went up" value={String(raised.length)} tone={raised.length ? 'warn' : undefined} />
        <StatTile label="Next charge" value={next ? shortDate(next.nextDate) : '–'} />
      </View>

      {soon.length > 0 && (
        <Section title="Coming up">
          {soon.map((s, i) => {
            const n = daysUntil(s.nextDate);
            return <ListRow key={s.vendor} title={s.vendor} figure={formatCents(s.amount)} note={n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${shortDate(s.nextDate)} · in ${n} days`} last={i === soon.length - 1} />;
          })}
        </Section>
      )}

      <Section title={`All subscriptions · ${subs.length}`} footer="Found from charges that repeat every month. AI cancels for you: you sign in yourself and approve the last step.">
        {subs.length === 0 && <Row title="None found yet" subtitle="They show up after two months of charges." last />}
        {subs.map((s, i) => <SubscriptionRow key={s.vendor} s={s} last={i === subs.length - 1} />)}
      </Section>

      <Section footer="A pretend service. Free, nothing real is touched.">
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/cancel', params: { demo: '1' } })}>
          <Row icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} title="Practice AI cancel" right={<Label style={{ color: t.tint }}>Start</Label>} last />
        </Pressable>
      </Section>
    </Screen>
  );
}

function SubscriptionRow({ s, last }: { s: Subscription; last: boolean }) {
  const t = useTheme();
  const route = cancelRoute(s.vendor);
  const apple = route?.via === 'apple';
  const up = s.amount - s.previousAmount;
  // Statement names can be cryptic ("APPLE.COM/BILL"); show the service's real name when known.
  const name = apple ? 'Apple subscriptions' : route?.via === 'agent' && route.known ? route.guide.name : s.vendor;
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <View accessible aria-label={`${name}, ${formatCents(s.amount)} a month, ${$(s.amount * 12)} a year, next charge ${shortDate(s.nextDate)}${up > 0 ? `, price up ${formatCents(up)}` : ''}`}
        style={{ flex: 1, gap: 3 }}>
        <View style={styles.between}>
          <Label style={{ fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{name}</Label>
          <Label style={{ fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCents(s.amount)}<Label secondary style={{ fontSize: 13 }}>/mo</Label></Label>
        </View>
        <View style={styles.between}>
          <Label secondary style={{ fontSize: 13, flexShrink: 1 }}>Next {shortDate(s.nextDate)} · {$(s.amount * 12)}/yr</Label>
          {up > 0 && <Tag tone="warn">{`Up ${formatCents(up)}`}</Tag>}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={apple ? `Manage ${name} in iPhone Settings` : `Cancel ${name} with AI`}
        onPress={() => router.push({ pathname: '/cancel', params: { vendor: s.vendor, amount: String(s.amount) } })}
        style={[styles.cancel, { backgroundColor: t.track }]}>
        {!apple && <AiMark size={12} color={t.redText} />}
        <Label style={{ color: apple ? t.tint : t.redText, fontSize: 14, fontWeight: '600' }}>{apple ? 'Manage' : 'Cancel'}</Label>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 12, padding: 16, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
});
