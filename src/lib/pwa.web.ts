/**
 * Registers public/sw.js, which lets the home-screen web app open quickly and show its shell
 * offline. It caches only the app's own code, fonts and icons, never budget or bank data.
 * Skipped in development so `expo start --web` always serves fresh code.
 */
export function registerServiceWorker() {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
  if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
}
