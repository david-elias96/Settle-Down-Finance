import * as SecureStore from 'expo-secure-store';
import { chunkedStore, type KeyValue } from './chunkedStore';

/**
 * Auth sessions live only in the iOS Keychain (policy section 4), readable only while the phone
 * is unlocked and never restored to another device. Keychain items are best kept small, so the
 * session is split into chunks (see chunkedStore.ts). The web app uses sessionStorage.web.ts instead.
 */
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const keychain: KeyValue = {
  get: (k) => SecureStore.getItemAsync(k, KEYCHAIN),
  set: (k, v) => SecureStore.setItemAsync(k, v, KEYCHAIN),
  remove: (k) => SecureStore.deleteItemAsync(k, KEYCHAIN),
};

export const sessionStorage = chunkedStore(keychain);
