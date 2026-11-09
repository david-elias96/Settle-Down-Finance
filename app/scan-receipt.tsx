import { useLocalSearchParams } from 'expo-router';
import { Row, Screen, Section } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents } from '@/src/domain';

/**
 * Receipt scanning (next milestone):
 * 1. Camera capture with document edge detection.
 * 2. Upload to the `receipt-scan` backend function, which uses an AI vision model to read line items.
 * 3. Show each item with a suggested bucket; the user confirms or changes it.
 * 4. `splitByReceipt` spreads tax/discounts so the split matches the bank amount exactly.
 */
export default function ScanReceipt() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const { transactions } = useBudget();
  const tx = transactions.find((t) => t.id === transactionId);
  return (
    <Screen>
      <Section footer="The camera and item reading are the next step. The split math is already built and tested.">
        <Row title={tx ? `${tx.merchant} · ${formatCents(tx.amount)}` : 'Receipt'} subtitle="Receipt scanning coming soon" last />
      </Section>
    </Screen>
  );
}
