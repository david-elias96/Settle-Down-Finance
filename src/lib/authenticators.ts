/**
 * Common authenticator apps. Tapping one copies the setup key, then opens the app if it's
 * installed, or its store page if not. The URL schemes are best-effort: if one is wrong, the
 * person lands on the store page, which shows "Open" for an installed app, so nothing breaks.
 */
export interface AuthenticatorApp {
  name: string;
  /** URL scheme that opens the installed app. */
  scheme: string;
  appStoreId: string;
  playPackage: string;
}

export const AUTHENTICATOR_APPS: AuthenticatorApp[] = [
  { name: 'Google Authenticator', scheme: 'googleauthenticator://', appStoreId: '388497605', playPackage: 'com.google.android.apps.authenticator2' },
  { name: 'Microsoft Authenticator', scheme: 'msauthv2://', appStoreId: '983156458', playPackage: 'com.azure.authenticator' },
  { name: '1Password', scheme: 'onepassword://', appStoreId: '1511601750', playPackage: 'com.onepassword.android' },
  { name: 'Authy', scheme: 'authy://', appStoreId: '494168017', playPackage: 'com.authy.authy' },
];

export function storeUrl(app: AuthenticatorApp, os: string) {
  return os === 'android'
    ? `https://play.google.com/store/apps/details?id=${app.playPackage}`
    : `https://apps.apple.com/app/id${app.appStoreId}`;
}

/**
 * Opens the app, or its store page when it isn't installed. Returns which one opened.
 * Takes the Linking object itself (not a bare openURL), because React Native's openURL needs
 * `this`: passed on its own it throws, and both attempts fail without anything opening.
 */
export async function openAuthenticator(app: AuthenticatorApp, os: string, linking: { openURL(url: string): Promise<unknown> }): Promise<'app' | 'store'> {
  try {
    await linking.openURL(app.scheme);
    return 'app';
  } catch {
    await linking.openURL(storeUrl(app, os));
    return 'store';
  }
}
