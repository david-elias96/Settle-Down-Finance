import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Button, Notice, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { BUCKET_NAME_MAX, parseBucketDraft } from '@/src/domain';

export default function NewBucket() {
  const { addBucket, buckets } = useBudget();
  const t = useTheme();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  // Say what's missing once they try to add, rather than a silent grey button.
  const [tried, setTried] = useState(false);
  const parsed = parseBucketDraft(name, limit, buckets);
  const input = { color: t.text, fontSize: 17, width: 150, textAlign: 'right' as const };

  const add = () => {
    setTried(true);
    if (!parsed.ok) return;
    addBucket(parsed.name, parsed.limit);
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  return (
    <Screen keyboardDone>
      <Section footer="A bucket is a monthly limit for one kind of spending, from $1 to $100,000. You can change the limit later.">
        <Row title="Name" right={<TextInput accessibilityLabel="Bucket name" style={input} value={name} onChangeText={setName} placeholder="e.g. Pets"
          placeholderTextColor={t.secondaryText} maxLength={BUCKET_NAME_MAX} returnKeyType="next" />} />
        <Row title="Monthly limit" right={<TextInput accessibilityLabel="Monthly limit in dollars" style={input} value={limit} onChangeText={setLimit}
          keyboardType="decimal-pad" placeholder="$0" placeholderTextColor={t.secondaryText} maxLength={12} onSubmitEditing={add} />} last />
      </Section>
      {tried && !parsed.ok && <Notice title={parsed.error} icon={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }} />}
      <Button title="Add bucket" onPress={add} />
    </Screen>
  );
}
