import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AheadCard, FreeCard, HeroCarousel, TrendCard } from '@/components/HomeCarousel';
import { WeeklyRecapCard } from '@/components/WeeklyRecap';
import { AiMark, BucketChip, Button, IconChip, Label, ListRow, Notice, PaceBar, Screen, Section, SettingsButton, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useBudget } from '@/src/data/BudgetStore';
import { bucketPace, byAttention, daysInMonth, formatCents, paceTag, weeklyAllowance, type BucketStatus, type Insight } from '@/src/domain';

const $ = (c: number) => formatCents(c, { showCents: false });

/**
 * Home. The headline says how the month is going; the carousel under it holds the three
 * ways to look at it (free to spend per day, the trend against last month with its
 * projection, and the bills ahead). Below: only what needs a look, then everything else.
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
  const [showAll, setShowAll] = useState(false);

  const sorted = byAttention(statuses, today, days);
  const tone = (s: BucketStatus) => paceTag(s, bucketPace(s, today, days)).tone;
  const flagged = sorted.filter((s) => tone(s) !== 'good');
  const fine = sorted.filter((s) => tone(s) === 'good');
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
        note={over ? `${$(s.spent)} of ${$(s.bucket.monthlyLimit)} · ${Math.max(0, days - today)} days to go`
          : tag.tone === 'warn' ? `Heading over · ${weeklyAllowance(s, today, days).text}`
          : `${$(s.spent)} of ${$(s.bucket.monthlyLimit)} · ${weeklyAllowance(s, today, days).text}`}
        leading={<BucketChip icon={s.bucket.icon} tone={tag.tone} />}
        bar={<PaceBar ratio={s.ratio} tone={tag.tone} paceAt={pace.monthElapsed} />}
        onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: s.bucket.id } })} />
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
  if (noData) {
    return (
      <Screen eyebrow={dateLabel} title="Welcome to Settle Down" action={<SettingsButton />}>
        {syncError && <Notice title={syncError} icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} />}
        {needsHousehold ? (
          <>
            <Notice title="Start your budget" icon={{ ios: 'house.fill', android: 'home', web: 'home' }}>
              Set up your household's budget to start sorting purchases into buckets. Joining a partner's budget instead? Open the invite link they sent you.
            </Notice>
            <Button title="Start our budget" onPress={startBudget} loading={starting} />
          </>
        ) : (
          <>
            <Notice title="Link a bank to get started" icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}>
              Your purchases sort into buckets as they post, and this screen fills in with what's left to spend, bills ahead and how the month is going.
            </Notice>
            <Button title="Link a bank" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/connect-bank')} />
          </>
        )}
        {sorted.length > 0 && (
          <Section title="Your buckets" footer="Tap a bucket to see it. Limits can be tuned once a few weeks of purchases are in.">
            {sorted.map((st, i) => bucketRow(st, i === sorted.length - 1))}
          </Section>
        )}
        {!needsHousehold && (
          <Button variant="secondary" title="Add custom bucket" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/new-bucket')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen eyebrow={dateLabel} title={verdict.text} action={<SettingsButton />}>
      {needsHousehold && (
        <>
          <Notice title="Start your budget" icon={{ ios: 'house.fill', android: 'home', web: 'home' }}>
            Set up your household's budget to start sorting purchases into buckets. Joining a partner's budget instead? Open the invite link they sent you.
          </Notice>
          <Button title="Start our budget" onPress={startBudget} loading={starting} />
        </>
      )}
      {syncError && <Notice title={syncError} icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} />}
      <HeroCarousel pages={[
        { key: 'free', label: 'Free to spend', node: <FreeCard free={free} days={recap.days} month={month} /> },
        { key: 'trend', label: 'Trend', node: <TrendCard trend={trend} forecast={forecast} month={month} /> },
        { key: 'ahead', label: 'Month ahead', node: <AheadCard ahead={ahead} free={free} forecast={forecast} today={today} /> },
      ]} />

      <Section title={flagged.length + alerts.length ? 'Needs a look' : 'All settled'}>
        {flagged.length + alerts.length === 0 && (
          <ListRow title="Every bucket is on track" note="Nothing needs your attention right now."
            leading={<IconChip icon={{ ios: 'checkmark', android: 'check', web: 'check' }} />} />
        )}
        {flagged.map((s) => bucketRow(s, false))}
        {alerts.map((i) => alertRow(i, false))}
        <Pressable onPress={() => router.push({ pathname: '/ask', params: { q: 'How can I cut my spending this month?' } })} accessibilityRole="button"
          style={({ pressed }) => [styles.askRow, pressed && { backgroundColor: t.track }]}>
          <AiMark size={16} />
          <Label style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>Ask how to cut spending this month</Label>
        </Pressable>
      </Section>

      {fine.length > 0 && (
        <Section>
          <ListRow title={`${fine.length} bucket${fine.length === 1 ? '' : 's'} on track`} last={!showAll}
            note={showAll ? null : `${$(fine.reduce((sum, s) => sum + Math.max(0, s.remaining), 0))} left across them`}
            leading={<IconChip icon={{ ios: 'checkmark', android: 'check', web: 'check' }} />}
            figure={showAll ? 'Hide' : 'Show'} onPress={() => setShowAll((v) => !v)} chevron={false} />
          {showAll && fine.map((s, i) => bucketRow(s, i === fine.length - 1))}
        </Section>
      )}

      <WeeklyRecapCard recap={recap} />

      <Section>
        <ListRow title="Patterns & tune-ups" last onPress={() => router.push('/patterns')}
          leading={<IconChip icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} />}
          note={[tuneUps.length ? `${tuneUps.length} suggestion${tuneUps.length === 1 ? '' : 's'}` : 'Limits match your spending',
            trends.length ? `${trends.length} change${trends.length === 1 ? '' : 's'} from usual` : null].filter(Boolean).join(' · ')} />
      </Section>

      <Button variant="secondary" title="Add custom bucket" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/new-bucket')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 50 },
});
