import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { Label, ListRow, Screen, Section, Tag, useTheme, AiMark } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { dayHeading, formatCents, splitLabel, splitShare, splitWays } from '@/src/domain';

/** One purchase: amount, where it went, whose card, and the receipt split. */
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, allocations, buckets, accountLabel, setBillSplit } = useBudget();
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
        {tx.split && <Label secondary style={{ fontSize: 14 }}>{splitLabel(tx)}</Label>}
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

      {tx.amount > 0 && (
        <SplitBill full={tx.split?.fullAmount ?? tx.amount} ways={tx.split ? tx.split.ways ?? 'custom' : 1} share={tx.amount}
          recurring={tx.split?.recurring ?? false} merchant={tx.merchant.trim()}
          onChange={(ways, share, every) => setBillSplit(tx.id,
            ways === 1 ? null : ways === 'custom' ? splitShare(share, tx.split?.fullAmount ?? tx.amount) : splitWays(ways), every)} />
      )}

      <Section title="Paid with">
        <ListRow title={accountLabel(tx.accountId) || 'Unknown account'} last />
      </Section>

      {parts.length <= 1 && (
        <Pressable onPress={() => router.push({ pathname: '/scan-receipt', params: { transactionId: tx.id } })} accessibilityRole="button"
          style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AiMark size={16} />
            <Label style={{ color: t.tint, fontSize: 17 }}>Scan receipt to split</Label>
          </View>
          <Label secondary style={{ fontSize: 13, marginTop: 2 }}>For mixed trips, like groceries + toys</Label>
        </Pressable>
      )}
    </Screen>
  );
}

type Ways = number | 'custom';

/**
 * Split a shared bill, like rent with roommates: pick how many ways, or type your share.
 * Only your share counts toward the bucket and your totals.
 */
function SplitBill({ full, ways, share, recurring, merchant, onChange }: {
  full: number; ways: Ways; share: number; recurring: boolean; merchant: string;
  onChange: (ways: Ways, share: number, everyCharge: boolean) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState(ways === 'custom' ? (share / 100).toFixed(2) : '');
  const options: { label: string; value: Ways }[] = [
    { label: 'Not split', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }, { label: 'Custom', value: 'custom' },
  ];
  const pick = (v: Ways) => {
    if (v === 'custom') { const cents = Math.round(Number(draft || (share / 100).toFixed(2)) * 100); setDraft((cents / 100).toFixed(2)); onChange(v, cents, recurring); }
    else onChange(v, share, recurring && v !== 1);
  };
  const commitDraft = () => {
    const cents = Math.round(Number(draft) * 100);
    if (cents > 0 && cents < full) onChange('custom', cents, recurring);
  };
  return (
    <Section title="Split this bill" footer={ways === 1
      ? 'Sharing this with roommates or family outside the app? Split it so only your part counts.'
      : `Only your ${formatCents(share)} counts toward your buckets and totals.`}>
      <View style={{ flexDirection: 'row', gap: 6, padding: 12 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = ways === o.value;
          return (
            <Pressable key={o.label} onPress={() => pick(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              aria-label={typeof o.value === 'number' && o.value > 1 ? `Split ${o.value} ways` : o.label}
              style={{ flexGrow: o.value === 1 || o.value === 'custom' ? 1.6 : 1, flexBasis: 0, paddingVertical: 8, borderRadius: 999, alignItems: 'center',
                backgroundColor: on ? t.tint : t.track }}>
              <Label style={{ fontSize: 14, fontWeight: '600', color: on ? '#FFFFFF' : t.text }}>{o.label}</Label>
            </Pressable>
          );
        })}
      </View>
      {ways === 'custom' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Label style={{ fontSize: 16, flex: 1 }}>Your share</Label>
            <Label style={{ fontSize: 16 }}>$</Label>
            <TextInput value={draft} onChangeText={setDraft} onEndEditing={commitDraft} onBlur={commitDraft} keyboardType="decimal-pad" returnKeyType="done"
              accessibilityLabel="Your share in dollars"
              style={{ color: t.text, fontSize: 16, width: 96, textAlign: 'right', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.track, fontVariant: ['tabular-nums'] }} />
          </View>
          <Label secondary style={{ fontSize: 13, textAlign: 'right' }}>of {formatCents(full)} · {Math.round((share / full) * 100)}%</Label>
        </View>
      )}
      {ways !== 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: t.separator }}>
          <View style={{ flex: 1 }}>
            <Label style={{ fontSize: 16 }}>Every {merchant} charge</Label>
            <Label secondary style={{ fontSize: 13 }}>Split future bills the same way</Label>
          </View>
          <Switch trackColor={{ true: t.tint }} value={recurring} onValueChange={(v) => onChange(ways, share, v)} accessibilityLabel={`Split every ${merchant} charge`} />
        </View>
      )}
    </Section>
  );
}
