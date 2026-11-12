import * as SecureStore from 'expo-secure-store';

/**
 * Small non-secret settings that should survive a restart (the email a sign-in code was sent to,
 * whether the bank-linking welcome was finished). Never tokens: sessions use sessionStorage.ts.
 * The web app uses prefs.web.ts.
 */
const OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const prefs = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTS).catch(() => null),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, OPTS).catch(() => {}),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTS).catch(() => {}),
};
