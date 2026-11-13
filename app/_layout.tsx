import { Fraunces_500Medium, Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { Oops } from '@/components/Oops';
import { Button, useTheme } from '@/components/ui';
import { useColorScheme } from '@/components/useColorScheme';
import { Fonts } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';
import { BudgetProvider } from '@/src/data/BudgetStore';
import { useNotificationRouting } from '@/src/notifications';
import { registerServiceWorker } from '@/src/lib/pwa';
import { installWebAlert } from '@/src/lib/webAlert';

/** Any crash on a screen lands here: the happy house, a calm message and a way to try again. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Oops title="Oops! Looks like something went wrong." detail={__DEV__ ? error.message : undefined}
      actions={<>
        <Button title="Try again" onPress={retry} />
        <Button title="Back to my budget" variant="secondary" onPress={() => { router.replace('/'); retry(); }} />
      </>}>
      Nothing's lost. Your budget and bank data are safe; this screen just tripped over itself.
    </Oops>
  );
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Web app only (no-ops in the iOS app): real alert dialogs, and the offline app shell.
installWebAlert();
registerServiceWorker();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_500Medium, Fraunces_600SemiBold, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, InstrumentSerif_400Regular, DMSerifDisplay_400Regular,
  });

  // A font that fails to load isn't worth a broken app: carry on with the system serif. (A web
  // deploy that dropped the font files once put every visitor on the error screen.)
  useEffect(() => {
    if (error) console.warn('Fonts failed to load; using system fonts', error);
  }, [error]);

  // The splash stays up until the fonts are in (or failed) and the saved session has been read (AppStack).
  if (!loaded && !error) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const t = useTheme();
  useNotificationRouting();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  // Navigation chrome in the Grove palette: cream behind every screen, green back buttons,
  // serif titles on the native header.
  const theme = { ...base, colors: { ...base.colors, primary: t.tint, background: t.background, card: t.background, text: t.text, border: t.separator } };

  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
      <BudgetProvider>
        <AppStack />
      </BudgetProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * The one route guard. With the backend connected, nobody sees the app until they're signed in:
 * signed out, only the sign-in flow is open; signed in to an account with two-step verification,
 * that second step finishes signing in; a household with no banks yet gets the "Link your banks"
 * welcome first. Invite links and the sign-in return page stay open to everyone. Previews
 * without backend settings run the whole app on sample data. Plaid Link keeps its own AAL2 and
 * consent gate (connect-bank.tsx and the backend).
 */
function AppStack() {
  const t = useTheme();
  const auth = useAuth();
  const { stage } = auth;

  useEffect(() => {
    if (stage !== 'loading') SplashScreen.hideAsync();
  }, [stage]);
  if (stage === 'loading') return null;

  const inApp = stage === 'preview' || (stage === 'signed_in' && !auth.needsOnboarding);
  // Typed as Href: the generated route list only picks up new screens on the next dev-server start.
  const home = (stage === 'signed_out' ? '/sign-in'
    : stage === 'step_up' ? '/two-step'
    // Signed in from an invite link: finish joining before anything else.
    : stage === 'signed_in' && auth.pendingInvite ? `/join/${auth.pendingInvite}`
    : stage === 'signed_in' && auth.needsOnboarding ? '/link-banks'
    : '/') as Href;

  return (
    <Stack screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: t.background },
      headerTintColor: t.tint,
      headerTitleStyle: { fontFamily: Fonts.display, fontSize: 19, color: t.text },
      contentStyle: { backgroundColor: t.background },
      // Our headers are opaque, so iOS 26's top scroll edge effect only shades the first lines
      // of content (it hid the two-step heading). Turn it off for stack screens.
      scrollEdgeEffects: { top: 'hidden' },
    }}>
      <Stack.Protected guard={inApp} redirectTo={home}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="new-bucket" options={{ presentation: 'modal', title: 'New Bucket' }} />
        <Stack.Screen name="goal-order" options={{ title: 'Goal Order', headerBackTitle: 'Back' }} />
        <Stack.Screen name="goal" options={{ presentation: 'modal', title: 'New Goal' }} />
        <Stack.Screen name="scan-receipt" options={{ presentation: 'modal', title: 'Scan Receipt' }} />
        <Stack.Screen name="bucket/[id]" options={{ title: 'Bucket', headerBackTitle: 'Back' }} />
        <Stack.Screen name="invite" options={{ presentation: 'modal', title: 'Invite' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
        <Stack.Screen name="transaction/[id]" options={{ title: 'Purchase', headerBackTitle: 'Back' }} />
        <Stack.Screen name="month" options={{ title: 'The month ahead', headerBackTitle: 'Back' }} />
        <Stack.Screen name="patterns" options={{ title: 'Patterns & tune-ups', headerBackTitle: 'Back' }} />
        <Stack.Screen name="cancel" options={{ title: 'Cancel subscription', headerBackTitle: 'Back' }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'signed_out'} redirectTo={home}>
        <Stack.Screen name="sign-in" options={{ title: 'Settle Down' }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'signed_in' && auth.needsOnboarding} redirectTo={home}>
        <Stack.Screen name="link-banks" options={{ title: 'Link your banks', headerBackVisible: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'preview' || !!auth.session} redirectTo={home}>
        <Stack.Screen name="two-step" options={{ title: 'Two-step verification', headerBackTitle: 'Back' }} />
        <Stack.Screen name="connect-bank" options={{ title: 'Link a bank', headerBackTitle: 'Back' }} />
      </Stack.Protected>
      {/* Open to everyone: invite links (they sign in from there) and where Google sign-in returns. */}
      <Stack.Screen name="join/[code]" options={{ title: 'Join' }} />
      <Stack.Screen name="auth-callback" options={{ title: 'Signing in', headerBackVisible: false }} />
    </Stack>
  );
}
