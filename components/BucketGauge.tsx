import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Display, Label, useTheme } from '@/components/ui';
import { formatCents, paceTag, type BucketPace, type BucketStatus } from '@/src/domain';

const SIZE = 220;
const STROKE = 14;
const R = (SIZE - STROKE) / 2 - 6;
const C = 2 * Math.PI * R;

/**
 * Ring showing how much of the bucket is used. The tick marks where an even pace
 * would be today, so filling past the tick means spending faster than planned.
 */
export function BucketGauge({ status, pace }: { status: BucketStatus; pace: BucketPace }) {
  const t = useTheme();
  const tone = paceTag(status, pace).tone;
  const color = tone === 'bad' ? t.red : tone === 'warn' ? t.orange : t.green;
  const used = Math.min(1, status.ratio);
  const overflow = Math.min(1, Math.max(0, status.ratio - 1)); // second lap for over-budget
  const tickAngle = pace.monthElapsed * 2 * Math.PI - Math.PI / 2;
  const cx = SIZE / 2;
  const tick = (r: number) => ({ x: cx + r * Math.cos(tickAngle), y: cx + r * Math.sin(tickAngle) });
  const inner = tick(R - STROKE / 2 - 4);
  const outer = tick(R + STROKE / 2 + 4);

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: 'center' }}
      accessible accessibilityLabel={`${status.bucket.name}: ${pace.percentUsed} percent used, ${pace.label}`}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={cx} cy={cx} r={R} stroke={t.track} strokeWidth={STROKE} fill="none" />
        <Circle cx={cx} cy={cx} r={R} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round"
          strokeDasharray={`${used * C} ${C}`} transform={`rotate(-90 ${cx} ${cx})`} />
        {overflow > 0 && (
          <Circle cx={cx} cy={cx} r={R} stroke={t.red} strokeOpacity={0.55} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={`${overflow * C} ${C}`} transform={`rotate(-90 ${cx} ${cx})`} />
        )}
        <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={t.text} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <Display size={48}>{pace.percentUsed}%</Display>
        <Label secondary style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}>
          {formatCents(status.spent, { showCents: false })} of {formatCents(status.bucket.monthlyLimit, { showCents: false })}
        </Label>
      </View>
    </View>
  );
}
