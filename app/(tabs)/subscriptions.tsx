import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AiMark, Display, HeroCard, IconChip, Label, ListRow, Row, Screen, Section, SettingsButton, StatTile, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { cancelRoute, findSubscriptions, formatCents, shortDate, type Subscription } from '@/src/domain';
import { backend } from '@/src/lib/backend';

const $ = (c: number) => formatCents(c, { showCents: false });
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${todayIso()}T12:00:00Z`)) / 86400000);

/**
 * Every recurring charge in one place: what it costs a month and a year, what's coming
 * up next, which prices went up, and a way to cancel each with AI.
 */
export default function SubscriptionsScreen() {
  const t = useTheme();
  const { transactions, month, today } = useBudget();
  const subs = findSubscriptions(transactions, `${month}-${String(today).padStart(2, '0')}`);
  const monthly = subs.reduce((s, x) => s + x.amount, 0);
  const raised = subs.filter((s) => s.amount > s.previousAmount);
  const next = [...subs].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  const soon = subs.filter((s) => { const n = daysUntil(s.nextDate); return n >= 0 && n <= 7; }).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <Screen title="Subscriptions" action={<SettingsButton />}>
      <HeroCard style={{ gap: 2 }}>
        <View accessible accessibilityRole="header" aria-label={`Subscriptions: ${formatCents(monthly)} a month, ${$(monthly * 12)} a year, ${subs.length} active`} style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: t.heroMuted }}>You pay for subscriptions</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Display size={48} color={t.heroText} style={{ lineHeight: 54, letterSpacing: -1.4 }}>{formatCents(monthly)}</Display>
            <Text style={{ fontSize: 17, fontWeight: '600', color: t.heroText, paddingBottom: 9 }}>a month</Text>
          </View>
          <Text style={{ fontSize: 15, color: t.heroMuted }}>{$(monthly * 12)} a year</Text>
        </View>
      </HeroCard>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Active" value={String(subs.length)} />
        <StatTile label="Price rises" value={String(raised.length)} tone={raised.length ? 'warn' : undefined} />
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

      <Section title="All subscriptions" footer="Found from charges that repeat every month. AI cancels for you: you sign in yourself and approve the last step.">
        {subs.length === 0 && <Row title="None found yet" subtitle="They show up after two months of charges." last />}
        {subs.map((s, i) => <SubscriptionRow key={s.vendor} s={s} last={i === subs.length - 1} />)}
      </Section>

      {/* Development previews only: a pretend service to watch the agent on. */}
      {!backend && (
        <Section footer="A pretend service. Free, nothing real is touched.">
          <ListRow title="Practice AI cancel" note="See how cancelling works" last
            leading={<IconChip icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} />}
            onPress={() => router.push({ pathname: '/cancel', params: { demo: '1' } })} />
        </Section>
      )}
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
        style={({ pressed }) => [styles.cancel, { backgroundColor: apple ? t.tintSoft : `${t.red}1F`, opacity: pressed ? 0.7 : 1 }]}>
        {!apple && <AiMark size={12} color={t.redText} />}
        <Label style={{ color: apple ? t.tint : t.redText, fontSize: 14, fontWeight: '600' }}>{apple ? 'Manage' : 'Cancel'}</Label>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cancel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, height: 36, minWidth: 84, borderRadius: 18 },
});
