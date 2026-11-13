import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Display, HeroCard, Intro, Label, Row, Screen, Section, space, useTheme } from '@/components/ui';
import { Fonts } from '@/constants/Colors';
import { useAuth } from '@/src/auth/AuthProvider';
import { billingSummary, CHOSEN_PLAN, parsePlan, PLAN_PRICES, type PlanId } from '@/src/domain';
import { prefs } from '@/src/lib/prefs';


const WEBSITE_PLANS = 'https://settledownfinancial.com/#pricing';
const INCLUDED = [
  'Every feature, for your whole household',
  'Purchase alerts with your bucket status',
  'Month-end projections and bill forecasts',
  '40 AI credits a month for Ask, receipt scans and the cancel assistant',
];

/**
 * Your plan. When paid plans are switched on and someone has no plan, trial or free access, the
 * route guard opens this first. The web app sells through Stripe Checkout (we never see card
 * details); the iPhone app doesn't sell here and points to the website instead.
 */
export default function PlansScreen() {
  const t = useTheme();
  const auth = useAuth();
  const params = useLocalSearchParams<{ checkout?: string; plan?: string }>();
  const billing = auth.billing;
  const [plan, setPlan] = useState<PlanId>(parsePlan(params.plan));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(params.checkout === 'success');
  const polls = useRef(0);
  const web = Platform.OS === 'web';

  // A plan picked on the website comes back preselected.
  useEffect(() => {
    if (params.plan) return;
    prefs.get(CHOSEN_PLAN).then((p) => { if (p) setPlan(parsePlan(p)); });
  }, [params.plan]);

  // Back from Stripe: the webhook usually lands within seconds. Check every 2s for up to 40s.
  const hasPlan = billing?.reason === 'subscribed';
  useEffect(() => {
    if (!waiting) return;
    if (hasPlan) {
      setWaiting(false);
      prefs.remove(CHOSEN_PLAN);
      router.replace('/' as Href);
      return;
    }
    if (polls.current >= 20) { setWaiting(false); setError('Your payment went through, but your plan is taking a moment. Pull to refresh or reopen the app in a minute.'); return; }
    const id = setTimeout(() => { polls.current += 1; auth.refresh().catch(() => {}); }, 2000);
    return () => clearTimeout(id);
  }, [waiting, hasPlan, billing, auth]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) {
      setError(e instanceof Error && e.message === 'already_subscribed' ? 'You already have a plan. Pull to refresh.' : 'Couldn’t reach checkout. Check your connection and try again.');
      setBusy(false);
    }
  };

  if (waiting) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: space.l, paddingVertical: 48 }}>
          <ActivityIndicator color={t.tint} size="large" />
          <Intro title="Setting up your plan">Thanks! This takes a few seconds.</Intro>
        </View>
      </Screen>
    );
  }

  const summary = billing ? billingSummary(billing) : null;
  const managed = !!billing && ['trialing', 'active', 'past_due'].includes(billing.status) && billing.reason === 'subscribed';
  const trial = billing?.canTrial !== false && (billing?.trialDays ?? 14) > 0;
  const trialDays = billing?.trialDays ?? 14;

  if (managed || billing?.reason === 'comp' || billing?.reason === 'household') {
    return (
      <Screen>
        <HeroCard>
          <Text style={[styles.heroEyebrow, { color: t.heroMuted }]}>YOUR PLAN</Text>
          <Display size={28} color={t.heroText}>{summary?.title}</Display>
          <Text style={{ color: t.heroMuted, fontSize: 15, lineHeight: 21, marginTop: 6 }}>{summary?.detail}</Text>
        </HeroCard>
        {managed && (web
          ? <Button title="Manage billing" onPress={() => run(auth.openBillingPortal)} loading={busy} />
          : <Button title="Manage billing on the web" variant="secondary" onPress={() => Linking.openURL('https://app.settledownfinancial.com/plans')} />)}
        {managed && <Label secondary style={styles.fine}>Change plan, update your card, see invoices or cancel. Billing is handled by Stripe.</Label>}
        {error && <Label style={{ ...styles.fine, color: t.redText }}>{error}</Label>}
      </Screen>
    );
  }

  if (!web) {
    // The iPhone app doesn't sell subscriptions itself (App Store rules); plans are on the website.
    return (
      <Screen>
        <Intro title="Choose a plan on the web">{summary?.detail ?? 'Start your free trial at settledownfinancial.com, then come back and sign in with the same account.'}</Intro>
        <Button title="Open settledownfinancial.com" onPress={() => Linking.openURL(WEBSITE_PLANS)} />
        <Button title="I’ve subscribed, check again" variant="secondary" onPress={() => auth.refresh()} />
        <Button title="Sign out" variant="plain" onPress={() => auth.signOut()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Intro title={trial ? `Try Settle Down free for ${trialDays} days` : 'Pick your plan'}>
        {trial
          ? 'Every feature, for your whole household. You won’t be charged today, and you can cancel in two taps before your trial ends.'
          : 'Every feature, for your whole household. Cancel anytime.'}
      </Intro>

      <View style={{ gap: space.m }} accessibilityRole="radiogroup">
        {(['yearly', 'monthly'] as PlanId[]).map((id) => {
          const p = PLAN_PRICES[id];
          const on = plan === id;
          return (
            <Pressable key={id} onPress={() => setPlan(id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              accessibilityLabel={`${p.label}, ${p.price} a ${p.per}. ${p.note}`}>
              <Card style={{ borderWidth: 2, borderColor: on ? t.tint : 'transparent' }} padded>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <View style={[styles.radio, { borderColor: on ? t.tint : t.separator }]}>{on && <View style={[styles.dot, { backgroundColor: t.tint }]} />}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                      <Label style={{ fontSize: 17, fontWeight: '600' }}>{p.label}</Label>
                      {id === 'yearly' && <View style={[styles.save, { backgroundColor: t.sun }]}><Text style={styles.saveText}>Save 30%</Text></View>}
                    </View>
                    <Label secondary style={{ fontSize: 14, marginTop: 2 }}>{p.note}</Label>
                  </View>
                  <Text style={{ fontFamily: Fonts.display, fontSize: 22, color: t.text }}>{p.price}<Text style={{ fontSize: 14, color: t.secondaryText }}>/{p.per === 'month' ? 'mo' : 'yr'}</Text></Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Button title={trial ? `Start my ${trialDays}-day free trial` : `Subscribe ${PLAN_PRICES[plan].label.toLowerCase()}`} loading={busy} onPress={() => run(() => auth.startCheckout(plan))} />
      {params.checkout === 'canceled' && !error && <Label secondary style={styles.fine}>Checkout was closed. Nothing was charged.</Label>}
      {error && <Label style={{ ...styles.fine, color: t.redText }}>{error}</Label>}
      <Label secondary style={styles.fine}>
        {trial
          ? `Card needed to start, charged ${PLAN_PRICES[plan].price} on day ${trialDays + 1} unless you cancel. We’ll email you before your trial ends. Payments are handled by Stripe; we never see your card.`
          : 'Payments are handled by Stripe; we never see your card.'}
      </Label>

      <Section title="Included">
        {INCLUDED.map((line, i) => (
          <Row key={line} icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} title={line} last={i === INCLUDED.length - 1} />
        ))}
      </Section>
      <Button title="Sign out" variant="plain" onPress={() => auth.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  fine: { fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: space.l },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  save: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { fontSize: 11, fontWeight: '700', color: '#1B2420' },
});
