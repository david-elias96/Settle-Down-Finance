import { Redirect } from 'expo-router';

/**
 * Where Google sign-in returns to (settledown://auth-callback). The sign-in sheet hands the
 * URL straight to the sign-in screen, so this only shows if the link opens the app another
 * way; it just goes home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
