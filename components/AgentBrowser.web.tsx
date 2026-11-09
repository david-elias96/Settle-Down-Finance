import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Text, View } from 'react-native';
import type { AgentBrowserHandle, BrowserSource } from './AgentBrowser';

export type { AgentBrowserHandle, BrowserSource } from './AgentBrowser';

/**
 * Web preview of the in-app browser. Only the practice site works here (a same-origin
 * iframe); real services need the iPhone app.
 */
export const AgentBrowser = forwardRef<AgentBrowserHandle, { source: BrowserSource; allowedDomains: string[]; userControl: boolean; onPageLoaded: () => void }>(
  function AgentBrowser({ source, onPageLoaded }, ref) {
    const frame = useRef<HTMLIFrameElement>(null);
    useImperativeHandle(ref, () => ({
      async evaluate(js) { return String((frame.current!.contentWindow as unknown as { eval: (s: string) => unknown }).eval(js)); },
      goTo() {},
      goBack() {},
    }), []);
    if (!('html' in source)) {
      return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text>Open this in the iPhone app.</Text></View>;
    }
    return <iframe ref={frame} srcDoc={source.html} onLoad={onPageLoaded} style={{ flex: 1, border: 0, width: '100%', height: '100%' }} />;
  },
);
