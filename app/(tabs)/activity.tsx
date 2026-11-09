import { Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents } from '@/src/domain';

export default function ActivityScreen() {
  const { transactions, allocations, buckets } = useBudget();
  const t = useTheme();
  const name = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unassigned';
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Section title="Transactions" footer="Tap “Scan receipt” to split a mixed purchase (like Target groceries + toys) across buckets.">
        {sorted.map((tx, i) => {
          const parts = allocations.filter((a) => a.transactionId === tx.id);
          const subtitle = parts.length > 1
            ? parts.map((p) => `${name(p.bucketId)} ${formatCents(p.amount)}`).join(' · ')
            : name(parts[0]?.bucketId ?? '');
          return (
            <Row key={tx.id} title={tx.merchant} subtitle={`${tx.date.slice(5)}${tx.pending ? ' · Pending' : ''} · ${subtitle}`}
              right={<Label style={{ fontVariant: ['tabular-nums'] }}>{formatCents(tx.amount)}</Label>} last={i === sorted.length - 1}>
              {parts.length <= 1 && (
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
