import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import {
  filterTransactions, formatCents, monthLabel, monthOptions, NO_FILTER, vendorOptions,
  type Option, type TransactionFilter,
} from '@/src/domain';

type Picker = 'month' | 'bucket' | 'vendor' | null;

export default function ActivityScreen() {
  const { transactions, allocations, buckets, month: currentMonth, accountLabel } = useBudget();
  const t = useTheme();
  const [filter, setFilter] = useState<TransactionFilter>({ ...NO_FILTER, month: currentMonth });
  const [open, setOpen] = useState<Picker>(null);
  const [search, setSearch] = useState('');

  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned';
  const { items, total } = useMemo(() => filterTransactions(transactions, allocations, filter), [transactions, allocations, filter]);

  // Each list only offers choices that exist under the other filters, so nothing leads to an empty result.
  const months = useMemo(() => monthOptions(filterTransactions(transactions, allocations, { ...filter, month: null }).items.map((i) => i.tx)), [transactions, allocations, filter]);
  const vendors = useMemo(() => vendorOptions(filterTransactions(transactions, allocations, { ...filter, vendor: null }).items.map((i) => i.tx)), [transactions, allocations, filter]);
  const bucketOpts = useMemo<Option[]>(() => {
    const scoped = filterTransactions(transactions, allocations, { ...filter, bucketId: null }).items;
    return buckets.filter((b) => !b.archived).map((b) => {
      const parts = scoped.flatMap((i) => i.parts).filter((p) => p.bucketId === b.id);
      return { value: b.id, label: b.name, count: parts.length, total: parts.reduce((s, p) => s + p.amount, 0) };
    }).filter((o) => o.count > 0);
  }, [transactions, allocations, buckets, filter]);

  const set = (patch: Partial<TransactionFilter>) => { setFilter((f) => ({ ...f, ...patch })); setOpen(null); setSearch(''); };
  const vendorLabel = vendors.find((v) => v.value === filter.vendor)?.label ?? filter.vendor;
  const active = filter.month !== null || filter.bucketId !== null || filter.vendor !== null;

  const options: { list: Option[]; selected: string | null; allLabel: string; pick: (v: string | null) => void } | null =
    open === 'month' ? { list: months, selected: filter.month, allLabel: 'All months', pick: (v) => set({ month: v }) }
    : open === 'bucket' ? { list: bucketOpts, selected: filter.bucketId, allLabel: 'All buckets', pick: (v) => set({ bucketId: v }) }
    : open === 'vendor' ? {
        list: vendors.filter((v) => v.label.toLowerCase().includes(search.trim().toLowerCase())),
        selected: filter.vendor, allLabel: 'All vendors', pick: (v) => set({ vendor: v }),
      }
    : null;

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={filter.month ? shortMonth(filter.month) : 'All months'} active={filter.month !== null} open={open === 'month'} onPress={() => setOpen(open === 'month' ? null : 'month')} />
          <Chip label={filter.bucketId ? bucketName(filter.bucketId) : 'All buckets'} active={filter.bucketId !== null} open={open === 'bucket'} onPress={() => setOpen(open === 'bucket' ? null : 'bucket')} />
          <Chip label={filter.vendor ? vendorLabel ?? 'Vendor' : 'All vendors'} active={filter.vendor !== null} open={open === 'vendor'} onPress={() => setOpen(open === 'vendor' ? null : 'vendor')} />
        </View>
        {active && !open && (
          <Pressable onPress={() => setFilter(NO_FILTER)} hitSlop={8}>
            <Label style={{ color: t.tint, fontSize: 15 }}>Clear filters</Label>
          </Pressable>
        )}
      </View>

      {options && (
        <Section>
          {open === 'vendor' && (
            <View style={[styles.search, { borderBottomColor: t.separator }]}>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search vendors" placeholderTextColor={t.secondaryText}
                style={{ color: t.text, fontSize: 17 }} autoCorrect={false} />
            </View>
          )}
          <OptionRow label={options.allLabel} selected={options.selected === null} onPress={() => options.pick(null)} />
          {options.list.map((o, i) => (
            <OptionRow key={o.value} label={o.label} detail={`${o.count} · ${formatCents(o.total, { showCents: false })}`}
              selected={options.selected === o.value} onPress={() => options.pick(o.value)} last={i === options.list.length - 1} />
          ))}
          {options.list.length === 0 && <Row title="No matches" last />}
        </Section>
      )}

      <Section title={`${items.length} transaction${items.length === 1 ? '' : 's'} · ${formatCents(total)}`}
        footer="Tap “Scan receipt” to split a mixed purchase (like Target groceries + toys) across buckets.">
        {items.length === 0 && <Row title="No transactions match these filters" last />}
        {items.map(({ tx, parts, amount }, i) => {
          const subtitle = parts.length > 1
            ? parts.map((p) => `${bucketName(p.bucketId)} ${formatCents(p.amount)}`).join(' · ')
            : bucketName(parts[0]?.bucketId ?? '');
          const isShare = amount !== tx.amount;
          return (
            <Row key={tx.id} title={tx.merchant}
              subtitle={`${tx.date.slice(5)}${tx.pending ? ' · Pending' : ''} · ${subtitle}${isShare ? ` · of ${formatCents(tx.amount)}` : ''}${accountLabel(tx.accountId) ? `\n${accountLabel(tx.accountId)}` : ''}`}
              right={<Label style={{ fontVariant: ['tabular-nums'] }}>{formatCents(amount)}</Label>} last={i === items.length - 1}>
              {parts.length <= 1 && !filter.bucketId && (
                <Link href={{ pathname: '/scan-receipt', params: { transactionId: tx.id } }} asChild>
                  <Pressable><Label style={{ color: t.tint, fontSize: 15 }}>Scan receipt</Label></Pressable>
                </Link>
              )}
            </Row>
          );
        })}
      </Section>
    </Screen>
  );
}

const shortMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function Chip({ label, active, open, onPress }: { label: string; active: boolean; open: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}
      style={[styles.chip, { backgroundColor: active ? t.tint : t.card, borderColor: active ? t.tint : t.separator }]}>
      <Label style={{ fontSize: 15, color: active ? '#FFFFFF' : t.text }}>{label} {open ? '▴' : '▾'}</Label>
    </Pressable>
  );
}

function OptionRow({ label, detail, selected, onPress, last }: { label: string; detail?: string; selected: boolean; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <Row title={label} last={last}
        right={<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {detail && <Label secondary style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>{detail}</Label>}
          <Label style={{ color: t.tint, fontSize: 17, width: 16 }}>{selected ? '✓' : ''}</Label>
        </View>} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  search: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
