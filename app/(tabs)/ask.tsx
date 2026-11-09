import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Label, useTheme } from '@/components/ui';
import { ask, SUGGESTED_QUESTIONS, type ChatTurn } from '@/src/ask';
import { useBudget } from '@/src/data/BudgetStore';

export default function AskScreen() {
  const t = useTheme();
  const { statuses, cutIdeas, month, today } = useBudget();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = turns;
    setTurns([...history, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    try {
      const answer = await ask(text, history, { statuses, cutIdeas, month, today });
      setTurns((ts) => [...ts, answer]);
    } catch (e) {
      setTurns((ts) => [...ts, { role: 'assistant', text: `Sorry, that didn't work: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
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
        ) : (
          <View key={i} style={[styles.bubble, { backgroundColor: t.card }]}>
            <Label style={{ fontSize: 16, lineHeight: 22 }}>{m.text}</Label>
            {m.preview && (
              <Label secondary style={{ fontSize: 12, marginTop: 8 }}>
                Preview answer from sample data. AI answers to any question turn on once your accounts are connected.
              </Label>
            )}
          </View>
        ))}
        {busy && <ActivityIndicator style={{ alignSelf: 'flex-start', marginLeft: 8 }} />}
      </ScrollView>
      <View style={[styles.inputBar, { borderTopColor: t.separator, backgroundColor: t.card }]}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Ask a question…" placeholderTextColor={t.secondaryText}
          style={[styles.input, { color: t.text, backgroundColor: t.background }]} onSubmitEditing={() => send(draft)}
          returnKeyType="send" multiline={false} maxLength={500} />
        <Pressable onPress={() => send(draft)} disabled={!draft.trim() || busy} accessibilityRole="button" accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: draft.trim() && !busy ? t.tint : t.track }]}>
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
  inputBar: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
