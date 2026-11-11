import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { Notice } from './ui';
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
      return <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}><Notice title="Open this in the iPhone app">Real services only work there. The practice run works here.</Notice></View>;
    }
    return <iframe ref={frame} srcDoc={source.html} onLoad={onPageLoaded} style={{ flex: 1, border: 0, width: '100%', height: '100%' }} />;
  },
);
