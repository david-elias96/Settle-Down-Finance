import { describe, expect, it } from 'vitest';
import { findSubscriptions, isBill, nextChargeOnOrAfter } from './insights';
import type { Transaction } from './types';

const tx = (id: string, date: string, merchant: string, amount: number, plaidCategory = 'ENTERTAINMENT'): Transaction =>
  ({ id, date, merchant, amount, plaidCategory } as Transaction);

describe('nextChargeOnOrAfter', () => {
  it('rolls a missed date forward to the next month', () => {
    expect(nextChargeOnOrAfter('2026-10-10', '2026-11-12')).toBe('2026-12-10');
    expect(nextChargeOnOrAfter('2026-10-20', '2026-11-12')).toBe('2026-11-20');
    expect(nextChargeOnOrAfter('2026-10-12', '2026-11-12')).toBe('2026-11-12');
  });
});

describe('isBill', () => {
  it('treats insurance, utilities, phone and rent as bills', () => {
    expect(isBill({ merchant: 'State Farm', plaidCategory: 'GENERAL_SERVICES' })).toBe(true);
    expect(isBill({ merchant: 'Verizon Wireless', plaidCategory: '' })).toBe(true);
    expect(isBill({ merchant: 'Maple Court Apartments', plaidCategory: '' })).toBe(true);
    expect(isBill({ merchant: 'Anything', plaidCategory: 'RENT_AND_UTILITIES' })).toBe(true);
    expect(isBill({ merchant: 'Netflix', plaidCategory: 'ENTERTAINMENT' })).toBe(false);
  });
});

describe('findSubscriptions', () => {
  const txs = [
    tx('1', '2026-09-10', 'Netflix', 1549), tx('2', '2026-10-10', 'Netflix', 1549),
    tx('3', '2026-09-10', 'State Farm', 12800, 'GENERAL_SERVICES'), tx('4', '2026-10-10', 'State Farm', 12800, 'GENERAL_SERVICES'),
  ];
  it('leaves bills out and never dates the next charge in the past', () => {
    const subs = findSubscriptions(txs, '2026-11-12');
    expect(subs.map((s) => s.vendor)).toEqual(['Netflix']);
    expect(subs[0].nextDate).toBe('2026-12-10');
  });
});
