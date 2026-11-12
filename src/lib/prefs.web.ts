/**
 * Web app: small non-secret settings in localStorage (the email a sign-in code was sent to, so a
 * reload while the person is in Mail keeps their place). Never tokens: the session is in
 * sessionStorage.web.ts, encrypted in IndexedDB.
 */
const ls = () => { try { return window.localStorage; } catch { return null; } };

export const prefs = {
  get: async (key: string) => { try { return ls()?.getItem(key) ?? null; } catch { return null; } },
  set: async (key: string, value: string) => { try { ls()?.setItem(key, value); } catch { /* private mode */ } },
  remove: async (key: string) => { try { ls()?.removeItem(key); } catch { /* private mode */ } },
};
