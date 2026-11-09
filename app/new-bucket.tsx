import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { dollars } from '@/src/domain';

export default function NewBucket() {
  const { addBucket } = useBudget();
  const t = useTheme();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const valid = name.trim().length > 0 && Number(limit) > 0;
  const input = { color: t.text, fontSize: 17, minWidth: 120, textAlign: 'right' as const };

  return (
    <Screen>
      <Section>
        <Row title="Name" right={<TextInput accessibilityLabel="Bucket name" style={input} value={name} onChangeText={setName} placeholder="e.g. Pets" placeholderTextColor={t.secondaryText} />} />
        <Row title="Monthly limit" right={<TextInput accessibilityLabel="Monthly limit in dollars" style={input} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="$0" placeholderTextColor={t.secondaryText} />} last />
      </Section>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} onPress={() => { addBucket(name.trim(), dollars(Number(limit))); router.back(); }}>
        <Label style={{ color: valid ? t.tint : t.secondaryText, fontSize: 17, textAlign: 'center' }}>Add bucket</Label>
      </Pressable>
    </Screen>
  );
}
