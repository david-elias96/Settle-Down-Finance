import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Label, ListRow, Screen, Section, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { dayHeading, formatCents } from '@/src/domain';

/** One purchase: amount, where it went, whose card, and the receipt split. */
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, allocations, buckets, accountLabel } = useBudget();
  const t = useTheme();
  const tx = transactions.find((x) => x.id === id);
  if (!tx) return <Screen><Label secondary>This purchase no longer exists.</Label></Screen>;
  const parts = allocations.filter((a) => a.transactionId === tx.id);
  const name = (bid: string) => buckets.find((b) => b.id === bid)?.name ?? 'Unassigned';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Purchase' }} />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <Label secondary style={{ fontSize: 15 }}>{tx.merchant.trim()}</Label>
        <Label style={{ fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatCents(tx.amount)}</Label>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Label secondary style={{ fontSize: 14 }}>{dayHeading(tx.date, new Date().toISOString().slice(0, 10))}</Label>
          {tx.pending && <Tag tone="neutral">Pending</Tag>}
        </View>
      </View>

      <Section title={parts.length > 1 ? 'Split across buckets' : 'Bucket'}>
        {parts.map((p, i) => (
          <ListRow key={i} title={name(p.bucketId)} figure={formatCents(p.amount)} last={i === parts.length - 1}
            note={p.source === 'receipt' ? 'From receipt' : p.source === 'rule' ? 'Your rule' : null}
            onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: p.bucketId } })} />
        ))}
      </Section>

      <Section title="Paid with">
        <ListRow title={accountLabel(tx.accountId) || 'Unknown account'} last />
      </Section>

      {parts.length <= 1 && (
        <Pressable onPress={() => router.push({ pathname: '/scan-receipt', params: { transactionId: tx.id } })} accessibilityRole="button"
          style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Label style={{ color: t.tint, fontSize: 17 }}>Scan receipt to split</Label>
          <Label secondary style={{ fontSize: 13, marginTop: 2 }}>For mixed trips, like groceries + toys</Label>
        </Pressable>
      )}
    </Screen>
  );
}
