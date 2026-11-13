import { useLocalSearchParams } from 'expo-router';
import { IconChip, ListRow, Screen, Section } from '@/components/ui';
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
      <Section footer="Coming soon. For now, move a purchase from its page.">
        <ListRow title={tx ? tx.merchant.trim() : 'Receipt'} figure={tx ? formatCents(tx.amount) : undefined} note="Receipt scanning is coming in an update" last
          leading={<IconChip icon={{ ios: 'doc.text.viewfinder', android: 'document_scanner', web: 'document_scanner' }} />} />
      </Section>
    </Screen>
  );
}
