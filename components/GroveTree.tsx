import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Rect } from 'react-native-svg';
import { useColorScheme } from './useColorScheme';
import { useTheme, type Tone } from './ui';

/** The logo's cloud crown: six round leaves, in a 100 × 110 box. The crown spans y 10–84. */
const LEAVES: [number, number, number][] = [[50, 28, 18], [35, 45, 18], [65.5, 45, 18], [28.5, 65.5, 15.5], [71.5, 65.5, 15.5], [50, 62, 22]];
const CROWN_TOP = 10;
const CROWN_BOTTOM = 84;

/** `a` blended over `b` (both #RRGGBB) at `amount`: an opaque tint, so overlapping leaves don't show seams. */
function mix(a: string, b: string, amount: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(n(a, i) * amount + n(b, i) * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A bucket (or goal) drawn as the tree from the logo. The crown fills from the bottom with
 * what's left (`fill`, 0–1), so a full crown means nothing spent yet and a bare one means
 * the money is gone. Amber when heading over; when over, the leaves have fallen.
 */
export function GroveTree({ fill, tone = 'good', size = 84, onHero }: { fill: number; tone?: Tone; size?: number; onHero?: boolean }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const clip = `crown${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const f = Math.max(0, Math.min(1, fill));
  const top = CROWN_BOTTOM - f * (CROWN_BOTTOM - CROWN_TOP);
  // On the deep green hero card the tree uses the logo's own leaf green and amber.
  const red = onHero ? '#FF9C86' : t.red;
  const leaf = tone === 'bad' ? red : tone === 'warn' ? (onHero ? t.sun : t.orange) : (onHero ? t.leaf : t.green);
  const ground = onHero ? t.hero : t.card;
  const bare = onHero ? mix(t.heroText, t.hero, 0.16) : tone === 'bad' ? mix(t.red, ground, 0.16) : tone === 'warn' ? mix(t.orange, ground, 0.2) : t.tintSoft;
  const trunk = onHero ? '#B39A76' : dark ? '#7A6448' : '#8A6F4E';
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 100 110" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={clip}><Rect x={0} y={top} width={100} height={110 - top} /></ClipPath>
      </Defs>
      <Rect x={47.5} y={70} width={5} height={34} rx={2.5} fill={trunk} />
      <G>{LEAVES.map(([cx, cy, r]) => <Circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill={bare} />)}</G>
      {f > 0 && <G clipPath={`url(#${clip})`}>{LEAVES.map(([cx, cy, r]) => <Circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill={leaf} />)}</G>}
      {tone === 'bad' && (
        <G>
          <Ellipse cx={30} cy={104} rx={5} ry={2.6} fill={red} opacity={0.75} />
          <Ellipse cx={66} cy={105} rx={4.5} ry={2.4} fill={onHero ? t.sun : t.orange} opacity={0.8} />
          <Ellipse cx={76} cy={102} rx={3.5} ry={2} fill={red} opacity={0.6} />
        </G>
      )}
      <Ellipse cx={50} cy={105} rx={24} ry={2.6} fill={onHero ? '#000000' : t.text} opacity={onHero ? 0.14 : 0.07} />
    </Svg>
  );
}
