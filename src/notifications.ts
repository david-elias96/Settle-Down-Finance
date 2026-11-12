import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { prefs } from '@/src/lib/prefs';

/** iOS notification category for transaction alerts; adds buttons when the alert is pressed and held. */
export const TRANSACTION_CATEGORY = 'transaction';

// Show alerts even while the app is open. (iOS app only: the web app has no push alerts yet.)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

function openFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { bucketId?: string; transactionId?: string } | undefined;
  if (response.actionIdentifier === 'scan-receipt' && data?.transactionId) {
    router.push({ pathname: '/scan-receipt', params: { transactionId: data.transactionId } });
  } else if (data?.bucketId) {
    router.push({ pathname: '/bucket/[id]', params: { id: data.bucketId } });
  }
}

/** Sets up notification buttons and routes taps to the right screen. Call once at the root. */
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationCategoryAsync(TRANSACTION_CATEGORY, [
      { identifier: 'view-bucket', buttonTitle: 'View bucket', options: { opensAppToForeground: true } },
      { identifier: 'scan-receipt', buttonTitle: 'Scan receipt', options: { opensAppToForeground: true } },
    ]).catch(() => {});

    // App launched by tapping a notification.
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last);

    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);
}

const PUSH_TOKEN = 'push-token';

/** The EAS project id that Expo push tokens are issued for (set by `eas init` in app.json). */
function easProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export type PushResult = 'on' | 'denied' | 'unavailable';

/**
 * Turns on purchase alerts for this phone: asks permission if `ask`, then saves the phone's Expo
 * push token to push_tokens (row-level security: only the signed-in user's own rows), which the
 * backend uses for purchase alerts and retention notices. iOS app only.
 */
export async function registerPushToken(db: SupabaseClient, userId: string, ask: boolean): Promise<PushResult> {
  if (Platform.OS === 'web') return 'unavailable';
  const projectId = easProjectId();
  if (!projectId) return 'unavailable';
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted && ask) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return 'denied';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await db.from('push_tokens').upsert({ user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() });
  if (error) throw error;
  await prefs.set(PUSH_TOKEN, token);
  return 'on';
}

/** Stops alerts for the signed-in user on this phone (before signing out). */
export async function unregisterPushToken(db: SupabaseClient, userId: string) {
  if (Platform.OS === 'web') return;
  const token = await prefs.get(PUSH_TOKEN);
  if (!token) return;
  await db.from('push_tokens').delete().eq('user_id', userId).eq('expo_push_token', token);
  await prefs.remove(PUSH_TOKEN);
}
