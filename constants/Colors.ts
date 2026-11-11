/**
 * Settle Down "Grove" palette, taken from the logo: deep green, leaf, cream paper and an
 * amber window light. Every text color passes WCAG AA (4.5:1) on both `card` and
 * `background`; `onTint` is the text color for filled tint buttons.
 */
const palette = {
  light: {
    text: '#17221D', secondaryText: '#56615A', background: '#F6F4EE', card: '#FFFFFF', separator: '#ECE9E1',
    tint: '#1F5B3F', onTint: '#FFFFFF', tintSoft: '#E3F1E6',
    green: '#2F7A4D', orange: '#E9A92B', red: '#C4472D', track: '#EEECE5',
    greenText: '#2A6E45', orangeText: '#875600', redText: '#A93A22',
    // The deep green hero card at the top of a tab, and the text on it.
    hero: '#1F5B3F', heroText: '#F3F7EF', heroMuted: '#C9DCCF', leaf: '#8FD19E', sun: '#F6C04E',
    chrome: '#FFFFFF', shadow: 'rgba(23,34,29,0.07)',
    // Stand-in for liquid glass where the real material isn't available (see `Glass`).
    glass: 'rgba(255,255,255,0.7)', glassSolid: 'rgba(255,255,255,0.94)', glassEdge: 'rgba(255,255,255,0.85)', glassShadow: 'rgba(23,34,29,0.14)',
    tabIconDefault: '#6B756F', tabIconSelected: '#1F5B3F',
  },
  dark: {
    text: '#E9EEEA', secondaryText: '#A9B4AD', background: '#0D1712', card: '#16241D', separator: '#24332B',
    tint: '#8FD19E', onTint: '#0D1712', tintSoft: '#1D3527',
    green: '#6CC287', orange: '#F6C04E', red: '#FF8A70', track: '#24332B',
    greenText: '#8FD19E', orangeText: '#F6C04E', redText: '#FF9C86',
    hero: '#1A3A2A', heroText: '#F3F7EF', heroMuted: '#A9C4B2', leaf: '#8FD19E', sun: '#F6C04E',
    chrome: '#16241D', shadow: 'rgba(0,0,0,0.35)',
    glass: 'rgba(28,46,37,0.66)', glassSolid: 'rgba(22,36,29,0.95)', glassEdge: 'rgba(233,238,234,0.12)', glassShadow: 'rgba(0,0,0,0.5)',
    tabIconDefault: '#8A968F', tabIconSelected: '#8FD19E',
  },
};
export default palette;

/** Fraunces, the serif from the logo wordmark, for display numbers and headings. */
export const Fonts = { display: 'Fraunces_600SemiBold', displayMedium: 'Fraunces_500Medium' } as const;
