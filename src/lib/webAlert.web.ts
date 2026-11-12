import { Alert } from 'react-native';
import { browserAlert } from './browserAlert';

/**
 * react-native-web's Alert.alert does nothing, which would silently swallow every error and
 * confirmation in the web app (sign-in failures, "Delete account?"). Route it to the browser's
 * dialogs instead. Called once at startup.
 */
export function installWebAlert() {
  (Alert as unknown as { alert: typeof Alert.alert }).alert = (title, message, buttons) =>
    browserAlert(window, title ?? '', message ?? undefined, buttons as never);
}
