import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** iOS notification category for transaction alerts; adds buttons when the alert is pressed and held. */
export const TRANSACTION_CATEGORY = 'transaction';

Notifications.setNotificationHandler({
  // Show alerts even while the app is open.
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

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
