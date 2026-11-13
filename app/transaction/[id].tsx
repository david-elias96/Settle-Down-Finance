import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { BucketChip, Button, Display, Gone, IconChip, Label, ListRow, Screen, Section, Tag, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { dayHeading, formatCents, splitLabel, splitShare, splitWays } from '@/src/domain';

/** One purchase: amount, where it went, whose card, and the receipt split. */
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, allocations, buckets, accountLabel, setBillSplit, moveToBucket } = useBudget();
  const tx = transactions.find((x) => x.id === id);
  if (!tx) return <Gone title="This purchase no longer exists">It may have been removed by your bank, or the link is old.</Gone>;
  const parts = allocations.filter((a) => a.transactionId === tx.id);
  const name = (bid: string) => buckets.find((b) => b.id === bid)?.name ?? 'Unassigned';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Purchase' }} />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <Label secondary style={{ fontSize: 15 }}>{tx.merchant.trim()}</Label>
        <Display size={48} style={{ lineHeight: 54 }}>{formatCents(tx.amount)}</Display>
        {tx.split && <Label secondary style={{ fontSize: 14 }}>{splitLabel(tx)}</Label>}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Label secondary style={{ fontSize: 14 }}>{dayHeading(tx.date, new Date().toISOString().slice(0, 10))}</Label>
          {tx.pending && <Tag tone="neutral">Pending</Tag>}
        </View>
      </View>

      <Section title={parts.length > 1 ? 'Split across buckets' : 'Bucket'}>
        {parts.map((p, i) => (
          <ListRow key={i} title={name(p.bucketId)} figure={formatCents(p.amount)} last={i === parts.length - 1}
            leading={<BucketChip icon={buckets.find((b) => b.id === p.bucketId)?.icon} />}
            note={p.source === 'receipt' ? 'From receipt' : p.source === 'ai' ? `Sorted by AI · ${p.reason ?? 'Best match'}`
              : p.source === 'rule' ? p.reason ?? 'Your rule' : p.source === 'user' ? 'You chose this' : null}
            onPress={() => router.push({ pathname: '/bucket/[id]', params: { id: p.bucketId } })} />
        ))}
        {tx.amount > 0 && (
          <MoveBucket current={parts.length === 1 ? parts[0].bucketId : null} merchant={tx.merchant.trim()} split={parts.length > 1}
            buckets={buckets.filter((b) => !b.archived)} onMove={(b, always) => moveToBucket(tx.id, b, always)} />
        )}
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
        <Section>
          <ListRow title="Scan receipt to split" note="For mixed trips, like groceries + toys" last
            leading={<IconChip icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} />}
            onPress={() => router.push({ pathname: '/scan-receipt', params: { transactionId: tx.id } })} />
        </Section>
      )}
    </Screen>
  );
}

/**
 * "Move to another bucket": a list of buckets, plus whether the store should always go there.
 * Always is on by default, since fixing one purchase usually means the store was misread.
 */
function MoveBucket({ current, merchant, split, buckets, onMove }: {
  current: string | null; merchant: string; split: boolean;
  buckets: { id: string; name: string }[]; onMove: (bucketId: string, always: boolean) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  // Off by default: re-sorting every past and future purchase from a store is a bigger step than moving one.
  const [always, setAlways] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const sep = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator };
  return (
    <View>
      <View style={[{ paddingHorizontal: 16, paddingVertical: 12, gap: 6, alignItems: 'flex-start' }, sep]}>
        <Button small variant="secondary" title={open ? 'Done' : split ? 'Put it all in one bucket' : 'Move to another bucket'}
          icon={open ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' }}
          onPress={() => setOpen((o) => !o)} />
        {moved && !open ? <Label secondary style={{ fontSize: 13 }}>{moved}</Label> : null}
      </View>
      {open && (
        <>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }, sep]}>
            <View style={{ flex: 1 }}>
              <Label style={{ fontSize: 15 }}>Always put {merchant} here</Label>
              <Label secondary style={{ fontSize: 13 }}>Moves past ones too, and future ones sort here</Label>
            </View>
            <Switch value={always} onValueChange={setAlways} trackColor={{ true: t.green }} thumbColor="#FFFFFF" accessibilityLabel={`Always put ${merchant} here`} />
          </View>
          {buckets.map((b) => (
            <Pressable key={b.id} onPress={() => {
              onMove(b.id, always); setOpen(false);
              setMoved(always ? `Moved. ${merchant} will always go to ${b.name}.` : `Moved to ${b.name}.`);
            }} accessibilityRole="radio" aria-checked={b.id === current}
              style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }, sep]}>
              <Label style={{ flex: 1, fontSize: 16 }}>{b.name}</Label>
              {b.id === current && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} weight="semibold" tintColor={t.tint} />}
            </Pressable>
          ))}
        </>
      )}
    </View>
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
              style={{ flexGrow: o.value === 1 || o.value === 'custom' ? 1.6 : 1, flexBasis: 0, height: 36, justifyContent: 'center', borderRadius: 999, alignItems: 'center',
                backgroundColor: on ? t.tint : t.track }}>
              <Label style={{ fontSize: 14, fontWeight: '600', color: on ? t.onTint : t.text }}>{o.label}</Label>
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
              style={{ color: t.text, fontSize: 16, width: 96, textAlign: 'right', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: t.track, fontVariant: ['tabular-nums'] }} />
          </View>
          <Label secondary style={{ fontSize: 13, textAlign: 'right' }}>of {formatCents(full)} · {Math.round((share / full) * 100)}%</Label>
        </View>
      )}
      {ways !== 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator }}>
          <View style={{ flex: 1 }}>
            <Label style={{ fontSize: 16 }}>Every {merchant} charge</Label>
            <Label secondary style={{ fontSize: 13 }}>Split future bills the same way</Label>
          </View>
          <Switch trackColor={{ true: t.green }} thumbColor="#FFFFFF" value={recurring} onValueChange={(v) => onChange(ways, share, v)} accessibilityLabel={`Split every ${merchant} charge`} />
        </View>
      )}
    </Section>
  );
}
