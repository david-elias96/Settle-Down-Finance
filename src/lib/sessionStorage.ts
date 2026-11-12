import * as SecureStore from 'expo-secure-store';

/**
 * Auth sessions live only in the iOS Keychain (policy section 4), readable only while the phone
 * is unlocked and never restored to another device. Keychain items are best kept small, so the
 * session is split into chunks. The web app uses sessionStorage.web.ts instead.
 */
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const CHUNK = 1800;

export const sessionStorage = {
  async getItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`, KEYCHAIN));
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`, KEYCHAIN)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    await sessionStorage.removeItem(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p, KEYCHAIN)));
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length), KEYCHAIN);
  },
  async removeItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`, KEYCHAIN)) || 0;
    await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`, KEYCHAIN)));
    await SecureStore.deleteItemAsync(`${key}.n`, KEYCHAIN);
  },
};
