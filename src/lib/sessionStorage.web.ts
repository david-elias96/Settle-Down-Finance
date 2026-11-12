/**
 * Web app (home-screen PWA) session storage. Browsers have no Keychain, so this is the closest
 * equivalent (policy section 4): the session is encrypted with AES-GCM under a key that the
 * browser generated as non-extractable, so its raw bytes can never be read out, copied off the
 * device or synced. Only the ciphertext and the key handle sit in this site's IndexedDB, which
 * iOS keeps per installed home-screen app. Never localStorage or AsyncStorage.
 */
import { openSealedStore, type SealedStore } from './sealedStore';

let store: Promise<SealedStore> | null = null;
const get = () => (store ??= openSealedStore(indexedDB, crypto.subtle));

export const sessionStorage = {
  async getItem(key: string) { return (await get()).get(key); },
  async setItem(key: string, value: string) { await (await get()).set(key, value); },
  async removeItem(key: string) { await (await get()).remove(key); },
};
