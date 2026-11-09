import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AgentBrowser, type AgentBrowserHandle, type BrowserSource } from '@/components/AgentBrowser';
import { Label, Screen, Section, useTheme } from '@/components/ui';
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

  const practice = () => setRun({ demo: true, name: 'StreamCo', source: { html: PRACTICE_SITE_HTML, baseUrl: PRACTICE_SITE_URL }, domains: ['practice.settledownfinance.com'] });

  async function start() {
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
  return <Intro name={name} amount={amount ? Number(amount) : undefined} practice={isPractice} route={route} vendor={vendor}
    website={website} setWebsite={setWebsite} onStart={start} starting={starting} />;
}

function Intro({ name, amount, practice, route, vendor, website, setWebsite, onStart, starting }: {
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
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <Label style={{ fontSize: 24, fontWeight: '700' }}>Cancel {name}</Label>
        {amount ? <Label secondary style={{ fontSize: 15 }}>{formatCents(amount)} a month</Label> : null}
      </View>

      {apple ? (
        <Section footer="Apple bills this one, so it's cancelled in your iPhone's subscription settings, not on a website.">
          <Pressable onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} style={[styles.primary, { backgroundColor: t.tint, margin: 16 }]}>
            <Label style={styles.primaryText}>Open iPhone Subscriptions</Label>
          </Pressable>
        </Section>
      ) : (
        <>
          <Section title="How it works">
            <Step icon="🔒" text="You sign in yourself, right on the service's own page. Claude never sees or stores your password." t={t} />
            <Step icon="✋" text="Claude skips the “stay for 50% off” offers and never buys or changes anything else." t={t} />
            <Step icon="✅" text="Nothing is cancelled until you approve the final step." t={t} last />
          </Section>
          {needsSite && (
            <Section title="Website" footer={`We don't have ${vendor} on file yet. Enter its website and Claude will find the cancel page there.`}>
              <TextInput accessibilityLabel="Website" value={website} onChangeText={setWebsite} placeholder="e.g. acmegym.com" placeholderTextColor={t.secondaryText}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ padding: 14, fontSize: 17, color: t.text }} />
            </Section>
          )}
          {note ? <Label secondary style={{ fontSize: 13, paddingHorizontal: 16 }}>Heads up: {note}</Label> : null}
          <Pressable onPress={onStart} disabled={starting || needsSite} accessibilityRole="button"
            style={[styles.primary, { backgroundColor: needsSite ? t.track : t.tint, marginHorizontal: 16 }]}>
            {starting ? <ActivityIndicator color="#FFFFFF" /> : <Label style={styles.primaryText}>{practice ? 'Start practice run' : 'Start'}</Label>}
          </Pressable>
          <Label secondary style={{ fontSize: 13, textAlign: 'center' }}>
            {practice ? 'Practice runs are free. Sign in with anything you like.' : `Uses ${CREDIT_COST.cancel_agent} credits, only if it works.`}
          </Label>
        </>
      )}
    </Screen>
  );
}

function Step({ icon, text, t, last }: { icon: string; text: string; t: ReturnType<typeof useTheme>; last?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 12, padding: 14 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <Label style={{ fontSize: 18 }}>{icon}</Label>
      <Label style={{ fontSize: 15, flex: 1, lineHeight: 21 }}>{text}</Label>
    </View>
  );
}

function AgentRun({ run }: { run: Run }) {
  const t = useTheme();
  const browser = useRef<AgentBrowserHandle>(null);
  const agent = useCancelAgent({ browser, allowedDomains: run.domains, demo: run.demo, session: run.session });
  const { phase } = agent;
  const userTurn = phase.name === 'your_turn';

  if (phase.name === 'done' || phase.name === 'error') {
    const success = phase.name === 'done' && (phase.outcome === 'cancelled' || phase.outcome === 'already_cancelled');
    return (
      <Screen>
        <Stack.Screen options={{ title: run.name, headerRight: () => null }} />
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 24 }}>
          <View style={[styles.badge, { backgroundColor: success ? t.green : t.orange }]}>
            <Label style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700' }}>{success ? '✓' : '!'}</Label>
          </View>
          <Label style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
            {success ? `${run.name} is cancelled` : phase.name === 'error' ? 'Something went wrong' : `${run.name} wasn't cancelled`}
          </Label>
          <Label secondary style={{ fontSize: 15, textAlign: 'center', paddingHorizontal: 12, lineHeight: 21 }}>
            {phase.name === 'done' ? phase.summary : phase.message}
          </Label>
        </View>
        {phase.name === 'done' && (phase.confirmation || phase.endsOn) && (
          <Section title="Proof">
            {phase.confirmation && <Detail label="Confirmation" value={phase.confirmation} t={t} />}
            {phase.endsOn && <Detail label="Access until" value={phase.endsOn} t={t} last />}
          </Section>
        )}
        {success && <Label secondary style={{ fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
          Saved to your records. If {run.name} charges you again, you'll get an alert.
        </Label>}
        {!run.demo && !success && <Label secondary style={{ fontSize: 13, textAlign: 'center' }}>Your credits were refunded.</Label>}
        <Pressable onPress={() => router.back()} style={[styles.primary, { backgroundColor: t.tint, marginHorizontal: 16 }]}>
          <Label style={styles.primaryText}>Done</Label>
        </Pressable>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen options={{ title: run.demo ? 'Practice run' : run.name, headerRight: () => (
        <Pressable onPress={() => { agent.stop(); router.back(); }} accessibilityRole="button"><Label style={{ color: t.redText, fontSize: 17 }}>Stop</Label></Pressable>
      ) }} />
      <View style={[styles.status, { backgroundColor: userTurn ? t.tint : t.card, borderBottomColor: t.separator }]}>
        {userTurn ? (
          <>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Your turn</Label>
              <Label style={{ color: '#FFFFFF', fontSize: 14 }}>{phase.message} Claude can't see what you type.</Label>
            </View>
            <Pressable onPress={agent.userDone} accessibilityRole="button" style={[styles.pill, { backgroundColor: '#FFFFFF' }]}>
              <Label style={{ color: t.tint, fontWeight: '700', fontSize: 14 }}>Done</Label>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <View style={{ flex: 1 }}>
              <Label secondary style={{ fontSize: 12 }}>Claude is working</Label>
              <Label style={{ fontSize: 15, fontWeight: '600' }}>{phase.status}</Label>
            </View>
          </>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AgentBrowser ref={browser} source={run.source} allowedDomains={run.domains} userControl={userTurn} onPageLoaded={agent.onPageLoaded} />
        {/* The page is hands-off while Claude works, so taps don't fight with it. */}
        {!userTurn && <View style={StyleSheet.absoluteFill} pointerEvents="auto" />}
      </View>
      {phase.name === 'confirm' && (
        <View style={[styles.sheet, { backgroundColor: t.card, borderTopColor: t.separator }]}>
          <Label style={{ fontSize: 18, fontWeight: '700' }}>Cancel {run.name}?</Label>
          <Label secondary style={{ fontSize: 15, lineHeight: 21 }}>This is the last step. Claude will click “{phase.button}” on {run.name}'s site.</Label>
          <Pressable onPress={() => agent.confirm(true)} accessibilityRole="button" style={[styles.primary, { backgroundColor: t.red }]}>
            <Label style={styles.primaryText}>Yes, cancel it</Label>
          </Pressable>
          <Pressable onPress={() => agent.confirm(false)} accessibilityRole="button" style={{ alignItems: 'center', padding: 10 }}>
            <Label style={{ color: t.tint, fontSize: 16 }}>Keep my subscription</Label>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Detail({ label, value, t, last }: { label: string; value: string; t: ReturnType<typeof useTheme>; last?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', padding: 14 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <Label secondary style={{ fontSize: 15 }}>{label}</Label>
      <Label style={{ fontSize: 15, fontWeight: '600' }}>{value}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 34, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
