import { forwardRef, useImperativeHandle, useRef, type ComponentType, type Ref } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { isAllowedUrl } from '@/src/domain';

// The library's iOS/Android/Windows prop types intersect to `never` under TypeScript 6,
// so the component is re-typed loosely here. Props below are checked against its docs.
const WV = WebView as unknown as ComponentType<Record<string, unknown> & { ref?: Ref<WebView> }>;

export type BrowserSource = { uri: string } | { html: string; baseUrl: string };

export interface AgentBrowserHandle {
  /** Runs a JS expression in the page and resolves with its (string) result. */
  evaluate(js: string): Promise<string>;
  goTo(url: string): void;
  goBack(): void;
}

interface Props {
  source: BrowserSource;
  allowedDomains: string[];
  /** While the user has control (e.g. to sign in) they may follow sign-in links to other sites. */
  userControl: boolean;
  onPageLoaded: () => void;
}

/**
 * The in-app browser the agent drives. Runs in a private session (incognito): cookies and
 * logins are thrown away when the screen closes, and nothing typed is ever read by the app.
 */
export const AgentBrowser = forwardRef<AgentBrowserHandle, Props>(function AgentBrowser({ source, allowedDomains, userControl, onPageLoaded }, ref) {
  const web = useRef<WebView>(null);
  const pending = useRef(new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }>());

  useImperativeHandle(ref, () => ({
    evaluate(js) {
      const rid = Math.random().toString(36).slice(2);
      return new Promise<string>((resolve, reject) => {
        pending.current.set(rid, { resolve, reject });
        setTimeout(() => { if (pending.current.delete(rid)) reject(new Error('The page did not respond')); }, 8000);
        web.current?.injectJavaScript(`(function(){var out;try{out={rid:'${rid}',r:String(${js})}}catch(e){out={rid:'${rid}',e:String(e)}}
          window.ReactNativeWebView.postMessage(JSON.stringify(out));})();true;`);
      });
    },
    goTo(url) { web.current?.injectJavaScript(`location.href=${JSON.stringify(url)};true;`); },
    goBack() { web.current?.goBack(); },
  }), []);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      const p = pending.current.get(msg.rid);
      if (!p) return;
      pending.current.delete(msg.rid);
      msg.e ? p.reject(new Error(msg.e)) : p.resolve(msg.r);
    } catch { /* messages from the page itself are ignored */ }
  };

  return (
    <WV
      ref={web}
      source={source}
      incognito
      sharedCookiesEnabled={false}
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
      onMessage={onMessage}
      onLoadEnd={onPageLoaded}
      originWhitelist={['https://*', 'about:*']}
      onShouldStartLoadWithRequest={(r: { url: string }) =>
        r.url.startsWith('about:') || isAllowedUrl(r.url, allowedDomains) || (userControl && r.url.startsWith('https://'))}
      style={{ flex: 1 }}
    />
  );
});
