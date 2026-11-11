import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Button, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { dollars } from '@/src/domain';

export default function NewBucket() {
  const { addBucket } = useBudget();
  const t = useTheme();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const valid = name.trim().length > 0 && Number(limit) > 0;
  const input = { color: t.text, fontSize: 17, width: 150, textAlign: 'right' as const };

  return (
    <Screen>
      <Section footer="A bucket is a monthly limit for one kind of spending. You can change the limit later.">
        <Row title="Name" right={<TextInput accessibilityLabel="Bucket name" style={input} value={name} onChangeText={setName} placeholder="e.g. Pets" placeholderTextColor={t.secondaryText} />} />
        <Row title="Monthly limit" right={<TextInput accessibilityLabel="Monthly limit in dollars" style={input} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="$0" placeholderTextColor={t.secondaryText} />} last />
      </Section>
      <Button title="Add bucket" disabled={!valid} onPress={() => { addBucket(name.trim(), dollars(Number(limit))); router.back(); }} />
    </Screen>
  );
}
