import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AnswerCard } from '@/components/AnswerCard';
import { Label, useTheme } from '@/components/ui';
import { ask, OutOfCreditsError, SUGGESTED_QUESTIONS, type ChatTurn } from '@/src/ask';
import { CREDIT_PACK, creditsResetLabel } from '@/src/domain';
import { useBudget } from '@/src/data/BudgetStore';

export default function AskScreen() {
  const t = useTheme();
  const { statuses, cutIdeas, transactions, buckets, month, today, recap, tuneUps, trends, creditBalance, credits, useCredits, syncCredits, addCreditPack } = useBudget();
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
    const backend = !!process.env.EXPO_PUBLIC_SUPABASE_URL;
    // In preview mode the phone keeps the balance; with the backend, the server charges.
    if (!backend && !useCredits('ask')) return;
    setTurns([...history, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    try {
      const answer = await ask(text, history, { statuses, cutIdeas, transactions, month, today, recap, tuneUps, trends });
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
    Alert.alert(
      `Get ${CREDIT_PACK.credits} more credits for ${CREDIT_PACK.price}?`,
      'App Store purchases switch on with the first TestFlight build. For this preview, the credits are added free.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Add credits', onPress: () => addCreditPack(CREDIT_PACK.credits) }],
    );
  }

  // Opened from the Insights card with a question ready to go.
  useEffect(() => { if (q) send(q); }, [q]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {turns.length === 0 && (
          <View style={{ gap: 12 }}>
            <Label style={{ fontSize: 22, fontWeight: '700' }}>Ask about your spending</Label>
            <Label secondary style={{ fontSize: 15 }}>Answers use your real buckets and transactions. Try one of these:</Label>
            {SUGGESTED_QUESTIONS.map((s) => (
              <Pressable key={s} onPress={() => send(s)} accessibilityRole="button"
                style={[styles.suggestion, { backgroundColor: t.card, borderColor: t.separator }]}>
                <Label style={{ fontSize: 16, color: t.tint }}>{s}</Label>
              </Pressable>
            ))}
          </View>
        )}
        {turns.map((m, i) => m.role === 'user' ? (
          <View key={i} style={[styles.bubble, styles.user, { backgroundColor: t.tint }]}>
            <Label style={{ color: '#FFFFFF', fontSize: 16 }}>{m.text}</Label>
          </View>
        ) : m.answer ? (
          <AnswerCard key={i} answer={m.answer} buckets={buckets} preview={m.preview} />
        ) : (
          <View key={i} style={[styles.bubble, { backgroundColor: t.card }]}>
            <Label style={{ fontSize: 16, lineHeight: 22 }}>{m.text}</Label>
          </View>
        ))}
        {busy && <ActivityIndicator style={{ alignSelf: 'flex-start', marginLeft: 8 }} />}
      </ScrollView>
      <View style={[styles.credits, { borderTopColor: t.separator, backgroundColor: t.card }]}>
        {outOfCredits ? (
          <>
            <Label secondary style={{ fontSize: 13, flex: 1 }}>
              You've used this month's {credits.allowance} questions. More arrive {creditsResetLabel(month)}.
            </Label>
            <Pressable onPress={buyPack} accessibilityRole="button" style={[styles.pack, { backgroundColor: t.tint }]}>
              <Label style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>+{CREDIT_PACK.credits} for {CREDIT_PACK.price}</Label>
            </Pressable>
          </>
        ) : (
          <Label secondary style={{ fontSize: 13 }}>
            {creditBalance.total} {creditBalance.total === 1 ? 'credit' : 'credits'} left
            {creditBalance.extra ? ` (${creditBalance.extra} extra)` : ''} · 1 per question · resets {creditsResetLabel(month)}
          </Label>
        )}
      </View>
      <View style={[styles.inputBar, { backgroundColor: t.card }]}>
        <TextInput accessibilityLabel="Ask a question" value={draft} onChangeText={setDraft} placeholder={outOfCredits ? 'Out of credits this month' : 'Ask a question…'} editable={!outOfCredits} placeholderTextColor={t.secondaryText}
          style={[styles.input, { color: t.text, backgroundColor: t.background }]} onSubmitEditing={() => send(draft)}
          returnKeyType="send" multiline={false} maxLength={500} />
        <Pressable onPress={() => send(draft)} disabled={!draft.trim() || busy || outOfCredits} accessibilityRole="button" accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: draft.trim() && !busy && !outOfCredits ? t.tint : t.track }]}>
          <Label style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>↑</Label>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  suggestion: { padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  bubble: { padding: 14, borderRadius: 16, maxWidth: '92%', alignSelf: 'flex-start' },
  user: { alignSelf: 'flex-end' },
  credits: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  pack: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  inputBar: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
