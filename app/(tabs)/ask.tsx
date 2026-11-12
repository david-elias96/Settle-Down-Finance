import { useLocalSearchParams } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { SymbolView } from 'expo-symbols';
import { useContext, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerCard } from '@/components/AnswerCard';
import { AiMark, Card, Label, SettingsButton, useTheme } from '@/components/ui';
import { Fonts } from '@/constants/Colors';
import { ask, OutOfCreditsError, SUGGESTED_QUESTIONS, type ChatTurn } from '@/src/ask';
import { CREDIT_PACK, creditsResetLabel } from '@/src/domain';
import { useBudget } from '@/src/data/BudgetStore';
import { useAuth } from '@/src/auth/AuthProvider';
import { backend } from '@/src/lib/backend';

export default function AskScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useContext(BottomTabBarHeightContext) ?? 0;
  const { statuses, cutIdeas, transactions, buckets, month, today, recap, tuneUps, trends, creditBalance, credits, useCredits, syncCredits, addCreditPack } = useBudget();
  const auth = useAuth();
  const outOfCredits = creditBalance.total === 0;
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy || outOfCredits) return;
    const history = turns;
    // In preview mode the phone keeps the balance; with the backend, the server charges.
    if (!backend && !useCredits('ask')) return;
    setTurns([...history, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    try {
      const answer = await ask(text, history, { householdId: auth.householdId, statuses, cutIdeas, transactions, month, today, recap, tuneUps, trends });
      if (answer.credits) syncCredits(answer.credits);
      setTurns((ts) => [...ts, answer]);
    } catch (e) {
      if (e instanceof OutOfCreditsError) {
        if (e.credits) syncCredits(e.credits);
        setTurns((ts) => ts.slice(0, -1));
        setDraft(text);
        return;
      }
      setTurns((ts) => [...ts, { role: 'assistant', text: `Sorry, that didn't work: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function buyPack() {
    // Signed in, credits are real: packs are bought through the App Store app (not yet released), never added free.
    if (backend) {
      Alert.alert('More credits', `Credit packs (${CREDIT_PACK.credits} for ${CREDIT_PACK.price}) will be available in the Settle Down iPhone app from the App Store. Your monthly credits reset ${creditsResetLabel(month)}.`);
      return;
    }
    Alert.alert(
      `Get ${CREDIT_PACK.credits} more credits for ${CREDIT_PACK.price}?`,
      'App Store purchases switch on with the first TestFlight build. For this preview, the credits are added free.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Add credits', onPress: () => addCreditPack(CREDIT_PACK.credits) }],
    );
  }

  // Opened from the home screen with a question ready to go.
  useEffect(() => { if (q) send(q); }, [q]);

  const canSend = !!draft.trim() && !busy && !outOfCredits;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 16, gap: 12 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>Ask</Text>
          <SettingsButton />
        </View>

        {turns.length === 0 && (
          <View style={{ gap: 12, marginTop: 8 }}>
            <Label secondary style={{ fontSize: 15, lineHeight: 21, paddingHorizontal: 4 }}>
              Ask anything about your spending. Answers use your own buckets and purchases.
            </Label>
            <Card>
              {SUGGESTED_QUESTIONS.map((s, i) => (
                <Pressable key={s} onPress={() => send(s)} accessibilityRole="button"
                  style={({ pressed }) => [styles.suggestion, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }, pressed && { backgroundColor: t.track }]}>
                  <AiMark size={16} />
                  <Label style={{ fontSize: 16, flex: 1, lineHeight: 21 }}>{s}</Label>
                  <SymbolView name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }} size={13} weight="semibold" tintColor={t.secondaryText} style={{ opacity: 0.6 }} />
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        {turns.map((m, i) => m.role === 'user' ? (
          <View key={i} style={[styles.bubble, styles.user, { backgroundColor: t.tint }]}>
            <Label style={{ color: t.onTint, fontSize: 16, lineHeight: 22 }}>{m.text}</Label>
          </View>
        ) : m.answer ? (
          <AnswerCard key={i} answer={m.answer} buckets={buckets} preview={m.preview} />
        ) : (
          <View key={i} style={[styles.bubble, { backgroundColor: t.card }]}>
            <Label style={{ fontSize: 16, lineHeight: 22 }}>{m.text}</Label>
          </View>
        ))}
        {busy && (
          <View style={styles.working} accessibilityLiveRegion="polite">
            <ActivityIndicator color={t.tint} />
            <Label secondary style={{ fontSize: 14 }}>SettleDown is working</Label>
          </View>
        )}
      </ScrollView>

      {/* Composer: sits just above the floating tab bar. */}
      <View style={{ paddingHorizontal: 16, paddingBottom: tabBar + 4, gap: 8 }}>
        <View style={styles.credits}>
          {outOfCredits ? (
            <>
              <Label secondary style={{ fontSize: 13, flex: 1 }}>
                You've used this month's {credits.allowance} questions. More arrive {creditsResetLabel(month)}.
              </Label>
              <Pressable onPress={buyPack} accessibilityRole="button" style={[styles.pack, { backgroundColor: t.tint }]}>
                <Label style={{ color: t.onTint, fontSize: 13, fontWeight: '600' }}>+{CREDIT_PACK.credits} for {CREDIT_PACK.price}</Label>
              </Pressable>
            </>
          ) : (
            <Label secondary style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
              {creditBalance.total} {creditBalance.total === 1 ? 'credit' : 'credits'} left
              {creditBalance.extra ? ` (${creditBalance.extra} extra)` : ''} · 1 per question · resets {creditsResetLabel(month)}
            </Label>
          )}
        </View>
        <View style={[styles.inputBar, { backgroundColor: t.card, boxShadow: `0 1px 2px ${t.shadow}, 0 8px 24px ${t.shadow}` }]}>
          <TextInput accessibilityLabel="Ask a question" value={draft} onChangeText={setDraft} placeholder={outOfCredits ? 'Out of credits this month' : 'Ask a question…'} editable={!outOfCredits} placeholderTextColor={t.secondaryText}
            style={[styles.input, { color: t.text }]} onSubmitEditing={() => send(draft)}
            returnKeyType="send" multiline={false} maxLength={500} />
          <Pressable onPress={() => send(draft)} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !canSend }}
            style={[styles.send, { backgroundColor: canSend ? t.tint : t.track }]}>
            <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={18} weight="bold" tintColor={canSend ? t.onTint : t.secondaryText} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.64 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, maxWidth: '88%', alignSelf: 'flex-start' },
  user: { alignSelf: 'flex-end', borderBottomRightRadius: 8 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  credits: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, minHeight: 20 },
  pack: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  inputBar: { flexDirection: 'row', gap: 8, paddingLeft: 20, paddingRight: 6, height: 52, borderRadius: 26, alignItems: 'center' },
  input: { flex: 1, fontSize: 16, height: 40 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
