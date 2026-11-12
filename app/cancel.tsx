import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentBrowser, type AgentBrowserHandle, type BrowserSource } from '@/components/AgentBrowser';
import { Button, Card, Display, Glass, IconChip, Intro, Label, ListRow, Notice, Pill, Screen, Section, fieldStyle, space, useTheme } from '@/components/ui';
import { agentBackendAvailable, startCancel } from '@/src/agent/client';
import { PRACTICE_SITE_HTML, PRACTICE_SITE_URL } from '@/src/agent/practiceSite';
import { useCancelAgent } from '@/src/agent/useCancelAgent';
import { cancelRoute, CREDIT_COST, formatCents } from '@/src/domain';

type Run = { demo: boolean; name: string; source: BrowserSource; domains: string[]; session?: { id: string; accessToken: string } };

/** Cancel a subscription with the AI agent, or practise on a pretend service. */
export default function CancelScreen() {
  const { vendor = '', amount, demo } = useLocalSearchParams<{ vendor?: string; amount?: string; demo?: string }>();
  const [website, setWebsite] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [starting, setStarting] = useState(false);
  const isPractice = demo === '1';
  const route = useMemo(() => (isPractice ? null : cancelRoute(vendor, website || undefined)), [vendor, website, isPractice]);
  const name = isPractice ? 'StreamCo (practice)' : route?.via === 'agent' ? route.guide.name : vendor;

  const practice = () => setRun({ demo: true, name: 'StreamCo', source: { html: PRACTICE_SITE_HTML, baseUrl: PRACTICE_SITE_URL }, domains: ['practice.settledownfinancial.com'] });

  async function start() {
    // The assistant drives the service's site inside an in-app browser, which only the iPhone
    // app has. The web app's security policy (no eval, no third-party frames) rules it out there.
    if (Platform.OS === 'web') {
      Alert.alert('Cancel from the iPhone app', 'The cancel assistant needs the iPhone app, coming to the App Store. On the web app, cancel on the service’s own website for now.');
      return;
    }
    if (isPractice) return practice();
    if (route?.via !== 'agent') return;
    const accessToken: string | undefined = undefined; // set once sign-in is connected
    const householdId: string | undefined = undefined;
    if (!agentBackendAvailable(accessToken) || !householdId) {
      Alert.alert('Almost there', `The agent can cancel ${route.guide.name} once sign-in is connected. Want to watch it on a practice site now?`, [
        { text: 'Not now', style: 'cancel' }, { text: 'Practice run', onPress: practice },
      ]);
      return;
    }
    setStarting(true);
    try {
      const s = await startCancel(accessToken!, householdId, vendor, website || undefined);
      setRun({ demo: false, name: s.serviceName, source: { uri: s.startUrl }, domains: s.domains, session: { id: s.sessionId, accessToken: accessToken! } });
    } catch (e) {
      Alert.alert("Couldn't start", (e as { code?: string }).code === 'out_of_credits' ? "You're out of AI credits this month." : (e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (run) return <AgentRun run={run} />;
  return <Start name={name} amount={amount ? Number(amount) : undefined} practice={isPractice} route={route} vendor={vendor}
    website={website} setWebsite={setWebsite} onStart={start} starting={starting} />;
}

function Start({ name, amount, practice, route, vendor, website, setWebsite, onStart, starting }: {
  name: string; amount?: number; practice: boolean; route: ReturnType<typeof cancelRoute>; vendor: string;
  website: string; setWebsite: (s: string) => void; onStart: () => void; starting: boolean;
}) {
  const t = useTheme();
  const apple = route?.via === 'apple';
  const needsSite = !practice && !route;
  const note = route?.via === 'agent' ? route.guide.note : undefined;
  return (
    <Screen>
      <Stack.Screen options={{ title: practice ? 'Practice run' : 'Cancel subscription' }} />
      <Intro title={`Cancel ${name}`}>{amount ? `${formatCents(amount)} a month` : undefined}</Intro>

      {apple ? (
        <Card padded>
          <View style={{ gap: space.m }}>
            <Label secondary style={styles.body}>Apple bills this one, so it's cancelled in your iPhone's subscription settings, not on a website.</Label>
            <Button title="Open iPhone Subscriptions" icon={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }}
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} />
          </View>
        </Card>
      ) : (
        <>
          <Section title="How it works">
            <Step icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} text="You sign in yourself, right on the service's own page. SettleDown never sees or stores your password." />
            <Step icon={{ ios: 'hand.raised.fill', android: 'back_hand', web: 'back_hand' }} text="SettleDown skips the “stay for 50% off” offers and never buys or changes anything else." />
            <Step icon={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} text="Nothing is cancelled until you approve the final step." last />
          </Section>
          {needsSite && (
            <Section title="Website" footer={`We don't have ${vendor} on file yet. Enter its website and SettleDown will find the cancel page there.`}>
              <TextInput accessibilityLabel="Website" value={website} onChangeText={setWebsite} placeholder="e.g. acmegym.com" placeholderTextColor={t.secondaryText}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[fieldStyle, { color: t.text }]} />
            </Section>
          )}
          {note ? <Notice title="Heads up">{note}</Notice> : null}
          <Card padded>
            <View style={{ gap: space.m }}>
              <Button title={practice ? 'Start practice run' : 'Start'} ai onPress={onStart} disabled={needsSite} loading={starting} />
              <Label secondary style={{ fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
                {practice ? 'Practice runs are free. Sign in with anything you like.' : `Uses ${CREDIT_COST.cancel_agent} credits, only if it works.`}
              </Label>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function Step({ icon, text, last }: { icon: SymbolViewProps['name']; text: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.step}>
      <IconChip icon={icon} />
      <Label style={{ fontSize: 15, flex: 1, lineHeight: 21 }}>{text}</Label>
      {!last && <View style={[styles.rule, { backgroundColor: t.separator }]} />}
    </View>
  );
}

function AgentRun({ run }: { run: Run }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const browser = useRef<AgentBrowserHandle>(null);
  const agent = useCancelAgent({ browser, allowedDomains: run.domains, demo: run.demo, session: run.session });
  const { phase } = agent;
  const userTurn = phase.name === 'your_turn';

  if (phase.name === 'done' || phase.name === 'error') {
    const success = phase.name === 'done' && (phase.outcome === 'cancelled' || phase.outcome === 'already_cancelled');
    return (
      <Screen>
        <Stack.Screen options={{ title: run.name, headerRight: () => null }} />
        <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.xl, paddingHorizontal: space.m }}>
          <View style={[styles.badge, { backgroundColor: success ? t.tintSoft : `${t.orange}1F` }]}>
            <SymbolView name={success ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'exclamationmark', android: 'priority_high', web: 'priority_high' }}
              size={32} weight="bold" tintColor={success ? t.tint : t.orangeText} />
          </View>
          <Display size={28} style={{ textAlign: 'center' }}>
            {success ? `${run.name} is cancelled` : phase.name === 'error' ? 'Something went wrong' : `${run.name} wasn't cancelled`}
          </Display>
          <Label secondary style={{ fontSize: 15, lineHeight: 21, textAlign: 'center' }}>
            {phase.name === 'done' ? phase.summary : phase.message}
          </Label>
        </View>
        {phase.name === 'done' && (phase.confirmation || phase.endsOn) && (
          <Section title="Proof">
            {phase.confirmation && <ListRow title="Confirmation" figure={phase.confirmation} last={!phase.endsOn} />}
            {phase.endsOn && <ListRow title="Access until" figure={phase.endsOn} last />}
          </Section>
        )}
        {success && <Notice icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} title="Saved to your records">
          {`If ${run.name} charges you again, you'll get an alert.`}
        </Notice>}
        {!run.demo && !success && <Notice title="Your credits were refunded" />}
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen options={{ title: run.demo ? 'Practice run' : run.name, headerRight: () => (
        <Pressable onPress={() => { agent.stop(); router.back(); }} accessibilityRole="button" accessibilityLabel="Stop" hitSlop={8} style={Platform.OS === 'web' ? { marginRight: space.l } : undefined}><Pill tone="bad">Stop</Pill></Pressable>
      ) }} />
      <View style={[styles.status, { backgroundColor: userTurn ? t.hero : t.card, borderBottomColor: t.separator }]}>
        {userTurn ? (
          <>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ color: t.heroText, fontWeight: '700', fontSize: 15 }}>Your turn</Label>
              <Label style={{ color: t.heroMuted, fontSize: 14, lineHeight: 19 }}>{phase.message} SettleDown can't see what you type.</Label>
            </View>
            <Button small title="Done" onPress={agent.userDone} style={{ backgroundColor: t.heroText }} textColor={t.hero} />
          </>
        ) : (
          <>
            <ActivityIndicator color={t.tint} />
            <View style={{ flex: 1, gap: 1 }}>
              <Label secondary style={{ fontSize: 12, fontWeight: '500' }}>SettleDown is working</Label>
              <Label style={{ fontSize: 15, fontWeight: '600' }}>{phase.status}</Label>
            </View>
          </>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AgentBrowser ref={browser} source={run.source} allowedDomains={run.domains} userControl={userTurn} onPageLoaded={agent.onPageLoaded} />
        {/* The page is hands-off while SettleDown works, so taps don't fight with it. */}
        {!userTurn && <View style={StyleSheet.absoluteFill} pointerEvents="auto" />}
      </View>
      {phase.name === 'confirm' && (
        <View style={[styles.sheetWrap, { bottom: Math.max(space.m, insets.bottom) }]}>
          <Glass corner={28} style={styles.sheet}>
            <Display size={24}>Cancel {run.name}?</Display>
            <Label secondary style={styles.body}>This is the last step. SettleDown will click “{phase.button}” on {run.name}'s site.</Label>
            <View style={{ gap: space.s, marginTop: space.xs }}>
              <Button variant="destructive" title="Yes, cancel it" onPress={() => agent.confirm(true)} />
              <Button variant="secondary" title="Keep my subscription" onPress={() => agent.confirm(false)} />
            </View>
          </Glass>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 21 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: 14 },
  rule: { position: 'absolute', left: space.l + 40 + space.m, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetWrap: { position: 'absolute', left: space.m, right: space.m },
  sheet: { padding: 20, gap: space.s },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
