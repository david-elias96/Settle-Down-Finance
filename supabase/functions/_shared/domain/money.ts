import type { Cents } from './types.ts';

export const dollars = (d: number): Cents => Math.round(d * 100);

export function formatCents(c: Cents, opts: { showCents?: boolean } = {}): string {
  const showCents = opts.showCents ?? true;
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole}${showCents ? `.${frac}` : ''}`;
}

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-08" → "Nov 8". */
export function shortDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** Day heading for lists: "Today", "Yesterday", or "Sat, Nov 8". `today` is YYYY-MM-DD. */
export function dayHeading(date: string, today: string): string {
  if (date === today) return 'Today';
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  if (Math.round((t.getTime() - d.getTime()) / 86400000) === 1) return 'Yesterday';
  return `${WEEKDAYS[d.getUTCDay()]}, ${shortDate(date)}`;
}
