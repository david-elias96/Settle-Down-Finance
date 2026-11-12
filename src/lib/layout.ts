import { Platform, useWindowDimensions } from 'react-native';
import { COLUMN_WIDTH, layoutFor, SIDEBAR_WIDTH } from './breakpoints';

export { COLUMN_WIDTH, SIDEBAR_WIDTH, layoutFor } from './breakpoints';

/** Wide-screen layout for the web app (see breakpoints.ts). Always the phone layout in the iPhone app. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const l = layoutFor(Platform.OS, width);
  /** Width of a screen's content column, gutters included (the whole window on phones). */
  const contentWidth = l.sidebar ? Math.min(width - SIDEBAR_WIDTH, COLUMN_WIDTH) : l.wide ? Math.min(width, COLUMN_WIDTH) : width;
  return { ...l, contentWidth };
}

/** Style that centers a block in the content column on wide screens (no-op on phones). */
export function columnStyle(wide: boolean) {
  return wide ? ({ width: '100%', maxWidth: COLUMN_WIDTH, alignSelf: 'center' } as const) : null;
}
