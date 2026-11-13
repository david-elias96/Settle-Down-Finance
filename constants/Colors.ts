/**
 * Settle Down "Grove" palette, taken from the logo: deep green, leaf, cream paper and an
 * amber window light. Every text color passes WCAG AA (4.5:1) on both `card` and
 * `background`; `onTint` is the text color for filled tint buttons.
 */
const grove = {
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

type Palette = typeof grove;
const darkFrom = grove.dark;

/** Mockup looks (choose at build time with EXPO_PUBLIC_LOOK); only the chosen one ships. */
const lime: Palette = {
  light: {
    text: '#0F1A14', secondaryText: '#56625B', background: '#F1F4EF', card: '#FFFFFF', separator: '#E6EAE3',
    tint: '#0F1A14', onTint: '#D7F56B', tintSoft: '#E7F7C4',
    green: '#1F9D55', orange: '#F08A24', red: '#E5484D', track: '#ECEFE9',
    greenText: '#167A42', orangeText: '#A04F00', redText: '#C3282E',
    hero: '#D4F36A', heroText: '#0F1A14', heroMuted: '#45552A', leaf: '#0F1A14', sun: '#F06A2A',
    chrome: '#FFFFFF', shadow: 'rgba(15,26,20,0.05)',
    glass: 'rgba(255,255,255,0.72)', glassSolid: 'rgba(255,255,255,0.95)', glassEdge: 'rgba(255,255,255,0.9)', glassShadow: 'rgba(15,26,20,0.12)',
    tabIconDefault: '#6B756F', tabIconSelected: '#0F1A14',
  },
  dark: darkFrom,
};
const ink: Palette = {
  light: {
    text: '#161513', secondaryText: '#6A655C', background: '#F6F3EC', card: '#FFFDF8', separator: '#E3DDD0',
    tint: '#161513', onTint: '#F6F3EC', tintSoft: '#ECE7DC',
    green: '#2E7D4F', orange: '#D99A1E', red: '#C2412D', track: '#ECE7DC',
    greenText: '#2A6E45', orangeText: '#8A5A00', redText: '#A93A22',
    hero: '#161513', heroText: '#F6F3EC', heroMuted: '#A9A396', leaf: '#5E5A52', sun: '#F2B53A',
    chrome: '#FFFDF8', shadow: 'rgba(22,21,19,0.06)',
    glass: 'rgba(22,21,19,0.82)', glassSolid: 'rgba(22,21,19,0.96)', glassEdge: 'rgba(255,255,255,0.10)', glassShadow: 'rgba(22,21,19,0.22)',
    tabIconDefault: '#A9A396', tabIconSelected: '#F6F3EC',
  },
  dark: darkFrom,
};
const sundown: Palette = {
  light: {
    text: '#2A1A24', secondaryText: '#6D5A63', background: '#FAF1EA', card: '#FFFFFF', separator: '#F1E3DA',
    tint: '#B4472A', onTint: '#FFFFFF', tintSoft: '#FBE4D8',
    green: '#3E8A5B', orange: '#E79A2A', red: '#C93C3C', track: '#F4E9E1',
    greenText: '#2F7049', orangeText: '#8E5600', redText: '#A93232',
    hero: '#3B2140', heroText: '#FFF3E8', heroMuted: '#D3BCC8', leaf: '#FFAE85', sun: '#FFD166',
    chrome: '#FFFFFF', shadow: 'rgba(59,33,64,0.08)',
    glass: 'rgba(255,250,246,0.72)', glassSolid: 'rgba(255,250,246,0.95)', glassEdge: 'rgba(255,255,255,0.9)', glassShadow: 'rgba(59,33,64,0.16)',
    tabIconDefault: '#7D6A72', tabIconSelected: '#B4472A',
  },
  dark: darkFrom,
};

const LOOK = (process.env.EXPO_PUBLIC_LOOK ?? 'grove') as 'grove' | 'lime' | 'ink' | 'sundown';
const palette: Palette = { grove, lime, ink, sundown }[LOOK] ?? grove;
export default palette;

/** Per-look shape: card corner radius and how cards separate from the background. */
export const Shape = ({
  grove: { card: 22, hero: 28, edge: 'shadow', section: 'serif', chip: 'soft', tab: 'tint' },
  lime: { card: 28, hero: 32, edge: 'flat', section: 'serif', chip: 'circle', tab: 'solid' },
  ink: { card: 12, hero: 14, edge: 'border', section: 'label', chip: 'outline', tab: 'tint' },
  sundown: { card: 24, hero: 30, edge: 'shadow', section: 'serif', chip: 'circle', tab: 'solid', gradient: ['#3B2140', '#6E2F45', '#B4523A'] },
} as const)[LOOK] as {
  card: number; hero: number; edge: 'shadow' | 'flat' | 'border'; section: 'serif' | 'label';
  chip: 'soft' | 'circle' | 'outline'; tab: 'tint' | 'solid'; gradient?: readonly string[];
};


/** Fraunces, the serif from the logo wordmark, for display numbers and headings. */
export const Fonts = ({
  grove: { display: 'Fraunces_600SemiBold', displayMedium: 'Fraunces_500Medium' },
  lime: { display: 'BricolageGrotesque_700Bold', displayMedium: 'BricolageGrotesque_600SemiBold' },
  ink: { display: 'InstrumentSerif_400Regular', displayMedium: 'InstrumentSerif_400Regular' },
  sundown: { display: 'DMSerifDisplay_400Regular', displayMedium: 'DMSerifDisplay_400Regular' },
} as const)[LOOK];
