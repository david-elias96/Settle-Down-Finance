import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FreeCard, GroveCard, HeroCarousel, MonthCard } from '@/components/HomeCarousel';
import { GroveTree } from '@/components/GroveTree';
import { WeeklyRecapCard } from '@/components/WeeklyRecap';
import { AiMark, BucketChip, Button, IconChip, Label, ListRow, Notice, PaceBar, Screen, Section, SettingsButton, toneTextColor, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useBudget } from '@/src/data/BudgetStore';
import { prefs } from '@/src/lib/prefs';
import { TOUR_SEEN } from '@/src/lib/tour';
import { bucketPace, byAttention, daysInMonth, formatCents, paceTag, weeklyAllowance, type BucketStatus, type Insight } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });

/**
 * Home. The headline says how the month is going; the carousel under it holds the ways to
 * look at it: the month (trend against last month, projected, and bills to come), the grove
 * (a tree per bucket whose crown empties as it's spent), and free to spend per day.
 * Below: only the buckets and stores worth a look.
 */
export default function BudgetScreen() {
  const { statuses, trend, forecast, month, today, insights, recap, tuneUps, trends, free, verdict, ahead, live, loading, syncError, transactions } = useBudget();
  const t = useTheme();
  const auth = useAuth();
  const [starting, setStarting] = useState(false);
  // Signed in but not in a household yet: start one (people joining by invite link get theirs from the link).
  const needsHousehold = auth.connected && !!auth.session && !auth.householdId;
  const startBudget = async () => {
    setStarting(true);
    try { await auth.ensureHousehold(); } catch { /* the notice stays so they can try again */ } finally { setStarting(false); }
  };
  const days = daysInMonth(month);

  const sorted = byAttention(statuses, today, days);
  const tone = (s: BucketStatus) => paceTag(s, bucketPace(s, today, days)).tone;
  const flagged = sorted.filter((s) => tone(s) !== 'good');
  // Alerts that aren't about a bucket's limit: a store costing more than usual, a price rise.
  const alerts = insights.filter((i) => i.kind === 'unusual_vendor' || i.kind === 'subscription_change').slice(0, 2);
  const dateLabel = new Date(`${month}-${String(today).padStart(2, '0')}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const bucketRow = (s: BucketStatus, last: boolean) => {
    const pace = bucketPace(s, today, days);
    const tag = paceTag(s, pace);
    const over = s.overBy > 0;
    return (
      <ListRow key={s.bucket.id} title={s.bucket.name} last={last}
        figure={over ? `${$(s.overBy)} over` : `${$(s.remaining)} left`} figureTone={over ? 'bad' : undefined}
        note={over ? `${$(s.spent)} / ${$(s.bucket.monthlyLimit)} · ${Math.max(0, days - today)} days left`
          : tag.tone === 'warn' ? `Heading over · ${weeklyAllowance(s, today, days).text}`
          : `${$(s.spent)} / ${$(s.bucket.monthlyLimit)} · ${weeklyAllowance(s, today, days).text}`}
        leading={<BucketChip icon={s.bucket.icon} tone={tag.tone} />}
        bar={<PaceBar ratio={s.ratio} tone={tag.tone} paceAt={pace.monthElapsed} />}
        onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: s.bucket.id } })} />
    );
  };

  const treeTile = (s: BucketStatus) => {
    const tn = tone(s);
    const over = s.overBy > 0;
    const figure = over ? `${$(s.overBy)} over` : `${$(s.remaining)} left`;
    return (
      <Pressable key={s.bucket.id} onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: s.bucket.id } })}
        accessibilityRole="button" aria-label={`${s.bucket.name}, ${figure}`}
        style={({ pressed }) => [styles.tile, pressed && { backgroundColor: t.track }]}>
        <GroveTree fill={s.bucket.monthlyLimit > 0 ? s.remaining / s.bucket.monthlyLimit : 0} tone={tn} size={72} />
        <Text numberOfLines={1} style={[styles.tileName, { color: t.text }]}>{s.bucket.name}</Text>
        <Text numberOfLines={1} style={[styles.tileFigure, { color: tn === 'good' ? t.secondaryText : toneTextColor(t, tn) }]}>{figure}</Text>
      </Pressable>
    );
  };

  const alertRow = (i: Insight, last: boolean) => (
    <ListRow key={i.id} title={i.card.label} figure={i.card.figure} note={i.card.note} last={last}
      leading={<IconChip tone={i.card.tone} icon={i.kind === 'subscription_change'
        ? { ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' }
        : { ios: 'storefront.fill', android: 'storefront', web: 'storefront' }} />}
      onPress={() => (i.kind === 'subscription_change' ? router.push('/subscriptions')
        : router.push({ pathname: '/activity', params: { vendor: i.vendor ?? i.card.label, at: String(Date.now()) } }))} />
  );

  // A new account (or a household before its first bank): no cards built from numbers that don't
  // exist yet, just the next step. Buckets still show so limits can be set ahead of time.
  const noData = transactions.length === 0 && !loading;
  // First time the home screen has numbers on it: show the short tour once.
  useEffect(() => {
    if (noData || loading) return;
    let gone = false;
    prefs.get(TOUR_SEEN).then((seen) => { if (!seen && !gone) { prefs.set(TOUR_SEEN, '1'); router.push('/tour'); } });
    return () => { gone = true; };
  }, [noData, loading]);
  if (noData) {
    return (
      <Screen eyebrow={dateLabel} title="Welcome to Settle Down" action={<SettingsButton />}>
        {syncError && <Notice title={syncError} icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} />}
        {needsHousehold ? (
          <>
            <Notice title="Start your budget" icon={{ ios: 'house.fill', android: 'home', web: 'home' }}>
              Joining a partner instead? Open their invite link.
            </Notice>
            <Button title="Start our budget" onPress={startBudget} loading={starting} />
          </>
        ) : (
          <>
            <Notice title="Link a bank to get started" icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}>
              Purchases sort into buckets as they post.
            </Notice>
            <Button title="Link a bank" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/connect-bank')} />
          </>
        )}
        {sorted.length > 0 && (
          <Section title="Your grove">
            <View style={styles.grove}>{sorted.map(treeTile)}</View>
          </Section>
        )}
        {!needsHousehold && (
          <Button variant="secondary" title="Add custom bucket" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/new-bucket')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen swoop eyebrow={dateLabel} title={verdict.text} action={<SettingsButton />}>
      {needsHousehold && (
        <>
          <Notice title="Start your budget" icon={{ ios: 'house.fill', android: 'home', web: 'home' }}>
            Joining a partner instead? Open their invite link.
          </Notice>
          <Button title="Start our budget" onPress={startBudget} loading={starting} />
        </>
      )}
      {syncError && <Notice title={syncError} icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} />}
      <HeroCarousel pages={[
        { key: 'month', label: 'Month', node: <MonthCard trend={trend} forecast={forecast} month={month} ahead={ahead} free={free} today={today} /> },
        { key: 'grove', label: 'Grove', node: <GroveCard statuses={sorted} today={today} month={month} /> },
        { key: 'free', label: 'Free to spend', node: <FreeCard free={free} days={recap.days} month={month} /> },
      ]} />

      <Section title={flagged.length + alerts.length ? 'Worth a look' : 'All settled'}>
        {flagged.map((s) => bucketRow(s, false))}
        {alerts.map((i) => alertRow(i, false))}
        <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'How can I cut my spending this month?' } })} accessibilityRole="button"
          style={({ pressed }) => [styles.askRow, pressed && { backgroundColor: t.track }]}>
          <AiMark size={16} />
          <Label style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>Ways to cut back</Label>
        </Pressable>
      </Section>

      <WeeklyRecapCard recap={recap} />

      <Section>
        <ListRow title="New bucket" onPress={() => router.push('/new-bucket')}
          leading={<IconChip icon={{ ios: 'plus', android: 'add', web: 'add' }} />} />
        <ListRow title="Tune-ups" last onPress={() => router.push('/patterns')}
          leading={<IconChip icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} />}
          note={[tuneUps.length ? `${tuneUps.length} idea${tuneUps.length === 1 ? '' : 's'}` : 'Limits fit',
            trends.length ? `${trends.length} shift${trends.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 50 },
  grove: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingHorizontal: 4 },
  tile: { width: '33.333%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 16, gap: 2 },
  tileName: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  tileFigure: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
