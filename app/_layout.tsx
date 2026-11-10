import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { BudgetProvider } from '@/src/data/BudgetStore';
import { useNotificationRouting } from '@/src/notifications';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useNotificationRouting();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <BudgetProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="new-bucket" options={{ presentation: 'modal', title: 'New Bucket' }} />
          <Stack.Screen name="goal" options={{ presentation: 'modal', title: 'New Goal' }} />
          <Stack.Screen name="scan-receipt" options={{ presentation: 'modal', title: 'Scan Receipt' }} />
          <Stack.Screen name="bucket/[id]" options={{ title: 'Bucket', headerBackTitle: 'Back' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal', title: 'Invite' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Purchase', headerBackTitle: 'Back' }} />
          <Stack.Screen name="patterns" options={{ title: 'Patterns & tune-ups', headerBackTitle: 'Back' }} />
          <Stack.Screen name="cancel" options={{ title: 'Cancel subscription', headerBackTitle: 'Back' }} />
          <Stack.Screen name="join/[code]" options={{ title: 'Join' }} />
        </Stack>
      </BudgetProvider>
    </ThemeProvider>
  );
}
