import { Stack, router } from 'expo-router';
import { Button, Intro, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Intro title="This screen doesn’t exist">The link may be old, or the page may have moved.</Intro>
      <Button title="Go to Budget" onPress={() => router.replace('/')} />
    </Screen>
  );
}
