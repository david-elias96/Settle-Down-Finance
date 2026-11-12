import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { Notice } from './ui';
import type { AgentBrowserHandle, BrowserSource } from './AgentBrowser';

export type { AgentBrowserHandle, BrowserSource } from './AgentBrowser';

/**
 * The web app has no in-app browser for the cancel assistant: its Content Security Policy
 * forbids eval and third-party frames (policy section 5), so the cancel screen stops before
 * a run starts. This stand-in only renders if a run is reached some other way.
 */
export const AgentBrowser = forwardRef<AgentBrowserHandle, { source: BrowserSource; allowedDomains: string[]; userControl: boolean; onPageLoaded: () => void }>(
  function AgentBrowser(_props, ref) {
    useImperativeHandle(ref, () => ({
      async evaluate() { throw new Error('The cancel assistant needs the iPhone app.'); },
      goTo() {},
      goBack() {},
    }), []);
    return <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}><Notice title="Open this in the iPhone app">The cancel assistant needs the iPhone app.</Notice></View>;
  },
);
