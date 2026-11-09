/** iOS system colors (light / dark). */
const palette = {
  light: {
    text: '#000000', secondaryText: '#6C6C70', background: '#F2F2F7', card: '#FFFFFF', separator: '#E5E5EA',
    tint: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', track: '#E5E5EA',
    // Darker versions for text, so small labels pass WCAG AA (4.5:1).
    greenText: '#1E7A34', orangeText: '#B33A00', redText: '#C70012',
    tabIconDefault: '#8E8E93', tabIconSelected: '#007AFF',
  },
  dark: {
    text: '#FFFFFF', secondaryText: '#AEAEB2', background: '#000000', card: '#1C1C1E', separator: '#38383A',
    tint: '#0A84FF', green: '#30D158', orange: '#FF9F0A', red: '#FF453A', track: '#3A3A3C',
    greenText: '#30DB5B', orangeText: '#FFB340', redText: '#FF6961',
    tabIconDefault: '#8E8E93', tabIconSelected: '#0A84FF',
  },
};
export default palette;
