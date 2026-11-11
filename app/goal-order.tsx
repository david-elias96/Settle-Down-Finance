import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View, type PanResponderInstance } from 'react-native';
import { Card, Notice, space, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents, moveItem } from '@/src/domain';

const ROW = 66;

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
    <ScrollView style={{ backgroundColor: t.background }} scrollEnabled={!drag} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.l, gap: space.xl }}>
      <Notice icon={{ ios: 'shield.lefthalf.filled', android: 'shield', web: 'shield' }} title="Drag goals up to protect them">
        If you overspend and other buckets can't cover it, money comes from the bottom goal first.
      </Notice>

      <View>
        <Text style={[styles.cap, { color: t.secondaryText, marginBottom: space.s + 2 }]}>Protected first</Text>
        <Card>
          <View style={{ height: order.length * ROW }}>
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
                  style={[styles.row, { top: clamped, backgroundColor: dragging ? t.tintSoft : t.card, zIndex: dragging ? 2 : 1 }]}>
                  <View style={[styles.rank, { backgroundColor: t.tintSoft }]}>
                    <Text style={{ color: t.tint, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{goal.name}</Text>
                    <Text style={{ color: t.secondaryText, fontSize: 13, fontVariant: ['tabular-nums'] }}>{$(goal.balance)} saved</Text>
                  </View>
                  <View {...responderFor(id).panHandlers} hitSlop={10} style={styles.handle} testID={`drag-${id}`}>
                    <SymbolView name={{ ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' }} tintColor={t.secondaryText} size={22} />
                  </View>
                  {i < order.length - 1 && !dragging && <View style={[styles.rule, { backgroundColor: t.separator }]} />}
                </View>
              );
            })}
          </View>
        </Card>
        <Text style={[styles.cap, { color: t.secondaryText, marginTop: space.s + 2 }]}>Used first when you overspend</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cap: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, marginHorizontal: space.xs },
  row: { position: 'absolute', left: 0, right: 0, height: ROW, userSelect: 'none', flexDirection: 'row', alignItems: 'center', gap: space.m, paddingLeft: space.l },
  rule: { position: 'absolute', left: space.l + 40 + space.m, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  rank: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 56, height: ROW, alignItems: 'center', justifyContent: 'center' },
});
