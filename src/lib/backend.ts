import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase client for the app. Only the project URL and the public anon key ship in the app
 * (policy section 5); everything else stays in edge-function secrets. Without them set, the app
 * runs on sample data (Expo Go previews).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Auth sessions live only in the iOS Keychain (policy section 4), readable only while the phone
 * is unlocked and never restored to another device. Keychain items are best kept small, so the
 * session is split into chunks.
 */
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const CHUNK = 1800;
const keychainStorage = {
  async getItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`, KEYCHAIN));
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`, KEYCHAIN)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    await keychainStorage.removeItem(key);
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

export const backend: SupabaseClient | null = url && anonKey && Platform.OS !== 'web'
  ? createClient(url, anonKey, {
    auth: { storage: keychainStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  : null;

/** Calls an edge function as the signed-in user. Throws with the function's error message. */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!backend) throw new Error('The app is not connected to the backend yet.');
  const { data, error } = await backend.functions.invoke(name, { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw Object.assign(new Error(detail?.error ?? error.message), { next: detail?.next });
  }
  return data as T;
}

export const PRIVACY_POLICY_URL = 'https://settledownfinance.com/privacy';
export const PLAID_PRIVACY_URL = 'https://plaid.com/legal/#end-user-privacy-policy';
