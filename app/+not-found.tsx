import { Stack, router } from 'expo-router';
import { Oops } from '@/components/Oops';
import { Button } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <Oops title="Oops! We couldn’t find that screen." actions={<Button title="Back to my budget" onPress={() => router.replace('/')} />}>
        The link may be old, or the screen may have moved. Your budget is right where you left it.
      </Oops>
    </>
  );
}
