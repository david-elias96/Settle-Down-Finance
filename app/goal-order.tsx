import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';
import { Label, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, moveItem } from '@/src/domain';

const ROW = 64;

/**
 * Drag goals into the order they should be protected. Overspending that other buckets
 * can't cover is taken from the bottom goal first.
 */
export default function GoalOrderScreen() {
  const { goals, setGoalOrder } = useBudget();
  const t = useTheme();
  const [order, setOrder] = useState(() => [...goals].sort((a, b) => a.priority - b.priority).map((g) => g.id));
  const [drag, setDrag] = useState<{ id: string; dy: number; start: number } | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  // Keep the list in step if a goal is added or deleted elsewhere.
  useEffect(() => {
    setOrder((o) => {
      const ids = new Set(goals.map((g) => g.id));
      const kept = o.filter((id) => ids.has(id));
      return [...kept, ...goals.filter((g) => !kept.includes(g.id)).sort((a, b) => a.priority - b.priority).map((g) => g.id)];
    });
  }, [goals]);

  const move = (from: number, to: number) => {
    const next = moveItem(orderRef.current, from, to);
    setOrder(next);
    setGoalOrder(next);
  };

  // One responder per goal, created once; it reads the current order from the ref.
  const responders = useRef(new Map<string, PanResponderInstance>()).current;
  const responderFor = (id: string) => {
    let r = responders.get(id);
    if (r) return r;
    let start = 0;
    const end = () => { setGoalOrder(orderRef.current); setDrag(null); };
    r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { start = orderRef.current.indexOf(id); setDrag({ id, dy: 0, start }); },
      onPanResponderMove: (_, g) => {
        const list = orderRef.current;
        const target = Math.max(0, Math.min(list.length - 1, start + Math.round(g.dy / ROW)));
        const at = list.indexOf(id);
        if (target !== at) setOrder(moveItem(list, at, target));
        setDrag({ id, dy: g.dy, start });
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
    responders.set(id, r);
    return r;
  };

  const $ = (c: number) => formatCents(c, { showCents: false });

  return (
    <ScrollView style={{ backgroundColor: t.background }} scrollEnabled={!drag} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 20 }}>
      <Label secondary style={{ fontSize: 15, paddingHorizontal: 4 }}>
        If you overspend and other buckets can't cover it, money comes from the bottom goal first. Drag goals up to protect them.
      </Label>

      <View>
        <Text style={[styles.cap, { color: t.secondaryText }]}>PROTECTED FIRST</Text>
        <View style={[styles.card, { backgroundColor: t.card, height: order.length * ROW }]}>
          {order.map((id, i) => {
            const goal = goals.find((g) => g.id === id);
            if (!goal) return null;
            const dragging = drag?.id === id;
            // The dragged row follows the finger; the others slide into their new slots.
            const top = dragging ? drag.start * ROW + drag.dy : i * ROW;
            const clamped = Math.max(0, Math.min((order.length - 1) * ROW, top));
            return (
              <View key={id}
                accessible accessibilityLabel={`${goal.name}, ${i + 1} of ${order.length}`}
                accessibilityHint="Swipe up or down to change its place"
                accessibilityActions={[{ name: 'increment', label: 'Move up' }, { name: 'decrement', label: 'Move down' }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'increment' && i > 0) move(i, i - 1);
                  if (e.nativeEvent.actionName === 'decrement' && i < order.length - 1) move(i, i + 1);
                }}
                style={[styles.row, {
                  top: clamped, backgroundColor: t.card, zIndex: dragging ? 2 : 1,
                  borderBottomColor: t.separator, borderBottomWidth: i === order.length - 1 && !dragging ? 0 : StyleSheet.hairlineWidth,
                }, dragging && styles.lifted]}>
                <View style={[styles.rank, { backgroundColor: t.track }]}>
                  <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }} numberOfLines={1}>{goal.name}</Text>
                  <Text style={{ color: t.secondaryText, fontSize: 13 }}>{$(goal.balance)} saved</Text>
                </View>
                <View {...responderFor(id).panHandlers} hitSlop={10} style={styles.handle} testID={`drag-${id}`}>
                  <SymbolView name={{ ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' }} tintColor={t.secondaryText} size={22} />
                </View>
              </View>
            );
          })}
        </View>
        <Text style={[styles.cap, { color: t.secondaryText, marginTop: 6 }]}>USED FIRST WHEN YOU OVERSPEND</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cap: { fontSize: 13, marginLeft: 16, marginBottom: 6 },
  card: { borderRadius: 12, overflow: 'hidden' },
  row: { position: 'absolute', left: 0, right: 0, height: ROW, userSelect: 'none', flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  lifted: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 56, height: ROW, alignItems: 'center', justifyContent: 'center' },
});
