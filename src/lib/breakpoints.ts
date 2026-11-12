/** Content column on wide screens: about a phone and a half, so cards and lists stay readable. */
export const COLUMN_WIDTH = 560;
/** Width of the sidebar that replaces the floating tab bar on desktop. */
export const SIDEBAR_WIDTH = 232;

/**
 * Layout for the web app on bigger screens. The iPhone app always uses the phone layout.
 * - wide (768 and up): content sits in a centered column instead of stretching edge to edge.
 * - sidebar (1024 and up): the tabs move to a sidebar on the left.
 */
export function layoutFor(platform: string, width: number) {
  const web = platform === 'web';
  return { wide: web && width >= 768, sidebar: web && width >= 1024 };
}
