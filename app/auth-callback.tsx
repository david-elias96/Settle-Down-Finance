import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { Button, Notice, Screen, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';

/**
 * Where Google sign-in returns to. In the iOS app (settledown://auth-callback) the sign-in sheet
 * hands the URL straight to the sign-in screen, so this only shows if the link opens the app
 * another way; it just goes home. In the web app the page itself comes back here with a
 * one-time code (PKCE), which is exchanged for a session before two-step verification.
 */
export default function AuthCallback() {
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  return <WebAuthCallback />;
}

function WebAuthCallback() {
  const t = useTheme();
  const auth = useAuth();
  // Only the code is read from the URL; error text in a link is never shown, so a crafted link can't put words on our screen.
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [failed, setFailed] = useState<string | null>(code ? null : 'Google sign-in was cancelled or did not finish.');

  useEffect(() => {
    if (!code || !auth.ready) return;
    let done = false;
    auth.finishWebSignIn(code)
      .then((hasFactor) => { if (!done) router.replace(hasFactor ? '/two-step' : '/two-step?setup=1'); })
      .catch(() => { if (!done) setFailed('That sign-in link expired or was already used. Please try again.'); });
    return () => { done = true; };
  }, [code, auth.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!failed) return <Screen><ActivityIndicator color={t.tint} style={{ marginTop: 48 }} /></Screen>;
  return (
    <Screen>
      <Notice title="Sign-in wasn't finished">{failed}</Notice>
      <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
