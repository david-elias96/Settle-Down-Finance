import type { Cents } from './types';

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
