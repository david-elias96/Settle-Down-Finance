import { router } from 'expo-router';
import { ActivitySummary, type SummaryData } from '@/components/ActivitySummary';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Label, ListRow, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import {
  dayHeading, filterTransactions, formatCents, monthLabel, monthOptions, NO_FILTER, vendorOptions,
  type Option, type TransactionFilter,
} from '@/src/domain';

type Picker = 'month' | 'bucket' | 'vendor' | null;

export default function ActivityScreen() {
  const { transactions, allocations, buckets, month: currentMonth, accounts, members, meId } = useBudget();
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

  const summary = useMemo<SummaryData>(() => {
    const monthName = filter.month ? monthLabel(filter.month).replace(` ${todayIso.slice(0, 4)}`, '') : null;
    const who = filter.vendor ? `At ${vendors.find((v) => v.value === filter.vendor)?.label ?? filter.vendor}` : filter.bucketId ? bucketName(filter.bucketId) : 'Spent';
    const scope = monthName ? `${who} in ${monthName}` : `${who}, all time`;
    return { scope, count: items.length, total };
  }, [items, total, filter, vendors, buckets]);

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
      <ActivitySummary data={summary} />
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={filter.month ? shortMonth(filter.month) : 'Months'} active={filter.month !== null} open={open === 'month'} onPress={() => setOpen(open === 'month' ? null : 'month')} />
          <Chip label={filter.bucketId ? bucketName(filter.bucketId) : 'Buckets'} active={filter.bucketId !== null} open={open === 'bucket'} onPress={() => setOpen(open === 'bucket' ? null : 'bucket')} />
          <Chip label={filter.vendor ? vendorLabel ?? 'Vendor' : 'Vendors'} active={filter.vendor !== null} open={open === 'vendor'} onPress={() => setOpen(open === 'vendor' ? null : 'vendor')} />
        </View>
        {active && !open && (
          <Pressable onPress={() => setFilter(NO_FILTER)} hitSlop={8} accessibilityRole="button">
            <Label style={{ color: t.tint, fontSize: 15 }}>Clear filters</Label>
          </Pressable>
        )}
      </View>

      {options && (
        <Section>
          {open === 'vendor' && (
            <View style={[styles.search, { borderBottomColor: t.separator }]}>
              <TextInput accessibilityLabel="Search vendors" value={search} onChangeText={setSearch} placeholder="Search vendors" placeholderTextColor={t.secondaryText}
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

      {items.length === 0 && <Section><Row title="No purchases match these filters" last /></Section>}
      {groupByDay(items).map(([date, group]) => (
        <Section key={date} title={dayHeading(date, todayIso)}>
          {group.map(({ tx, parts, amount }, i) => {
            const bucket = buckets.find((b) => b.id === parts[0]?.bucketId);
            const owner = accounts.find((a) => a.id === tx.accountId)?.ownerId;
            const note = [
              parts.map((p) => bucketName(p.bucketId)).join(' + '),
              tx.pending ? 'Pending' : null,
              owner && owner !== meId ? `${members.find((m) => m.id === owner)?.name ?? 'Family'}'s card` : null,
              amount !== tx.amount ? `share of ${formatCents(tx.amount)}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <ListRow key={tx.id} title={tx.merchant.trim()} figure={formatCents(amount)} note={note} last={i === group.length - 1}
                leading={<View style={[styles.icon, { backgroundColor: t.track }]}>
                  <SymbolView name={{ ios: (bucket?.icon ?? 'circle') as any, android: 'category', web: 'category' }} size={15} tintColor={t.secondaryText} />
                </View>}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })} />
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}

const todayIso = new Date().toISOString().slice(0, 10);

function groupByDay<T extends { tx: { date: string } }>(items: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(it.tx.date, [...(m.get(it.tx.date) ?? []), it]);
  return [...m].sort((a, b) => b[0].localeCompare(a[0]));
}

// "Nov" this year, "Nov 2025" otherwise, so the three filters fit on one line.
const shortMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', ...(m.startsWith(todayIso.slice(0, 4)) ? {} : { year: 'numeric' }), timeZone: 'UTC' });

function Chip({ label, active, open, onPress }: { label: string; active: boolean; open: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}
      style={[styles.chip, { backgroundColor: active ? t.tint : t.card, borderColor: active ? t.tint : t.separator }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: 15, color: active ? '#FFFFFF' : t.text }}>{label}</Text>
      <Text style={{ fontSize: 12, color: active ? '#FFFFFF' : t.secondaryText }}>{open ? '▴' : '▾'}</Text>
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
  chip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  search: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
