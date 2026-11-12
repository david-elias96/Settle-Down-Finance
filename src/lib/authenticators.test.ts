import { describe, expect, it } from 'vitest';
import { AUTHENTICATOR_APPS, openAuthenticator, storeUrl } from './authenticators';

const google = AUTHENTICATOR_APPS[0];

describe('openAuthenticator', () => {
  it('opens the app when it is installed', async () => {
    const opened: string[] = [];
    expect(await openAuthenticator(google, 'ios', { openURL: async (u) => { opened.push(u); } })).toBe('app');
    expect(opened).toEqual(['googleauthenticator://']);
  });

  it('falls back to the App Store when the app is missing', async () => {
    const opened: string[] = [];
    const open = async (u: string) => { opened.push(u); if (!u.startsWith('https:')) throw new Error('no app'); };
    expect(await openAuthenticator(google, 'ios', { openURL: open })).toBe('store');
    expect(opened[1]).toBe('https://apps.apple.com/app/id388497605');
  });

  it('calls openURL as a method, like React Native Linking needs', async () => {
    // React Native's Linking.openURL reads `this`; calling it detached throws.
    class FakeLinking {
      opened: string[] = [];
      async openURL(u: string) { this.opened.push(u); }
    }
    const linking = new FakeLinking();
    expect(await openAuthenticator(google, 'ios', linking)).toBe('app');
    expect(linking.opened).toEqual(['googleauthenticator://']);
  });

  it('uses the Play Store on Android', () => {
    expect(storeUrl(google, 'android')).toBe('https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2');
  });

  it('lists only https store links and app schemes', () => {
    for (const a of AUTHENTICATOR_APPS) {
      expect(a.scheme).toMatch(/^[a-z0-9]+:\/\/$/);
      expect(a.appStoreId).toMatch(/^\d+$/);
    }
  });
});
