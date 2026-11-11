import { describe, expect, it } from 'vitest';
import { dollars, freeToSpend, monthAhead, monthVerdict, type Bill, type Bucket } from './index';

const bucket = (id: string, limit: number): Bucket => ({ id, name: id, icon: 'circle', monthlyLimit: dollars(limit), isCustom: false });
const status = (id: string, limit: number, spent: number) => ({ bucket: bucket(id, limit), spent: dollars(spent) });
const bill = (vendor: string, amount: number, dueDate: string, status: Bill['status'], paidOn?: string): Bill => ({
  vendor, key: vendor.toLowerCase(), amount: dollars(amount), low: dollars(amount), high: dollars(amount), varies: false, dueDate, status, months: 4,
  paid: paidOn ? { amount: dollars(amount), date: paidOn, transactionId: `tx-${vendor}` } : undefined,
});
const tx = (id: string, date: string, amount: number) => ({ id, date, amount: dollars(amount) });

describe('freeToSpend', () => {
  const statuses = [status('groceries', 700, 500), status('housing', 1800, 1000), status('fun', 500, 100)];

  it('spreads what is left after bills over the days left, counting today', () => {
    const f = freeToSpend(statuses, [bill('Power', 100, '2026-11-15', 'due'), bill('Rent', 1000, '2026-11-01', 'paid', '2026-11-01')], [], '2026-11', 11);
    // 3,000 budget − 1,600 spent − 100 bills = 1,300 over 20 days (Nov 11–30).
    expect(f).toMatchObject({ budget: dollars(3000), spent: dollars(1600), billsToCome: dollars(100), leftThisMonth: dollars(1300), daysLeft: 20, perDay: dollars(65), spentToday: 0, leftToday: dollars(65) });
  });

  it("holds today's number steady while you spend", () => {
    // $40 of the $1,600 was spent today, so the day began with 1,340 left: $67 a day, and it stays $67.
    const f = freeToSpend(statuses, [bill('Power', 100, '2026-11-15', 'due')], [tx('a', '2026-11-11', 40), tx('old', '2026-11-10', 99)], '2026-11', 11);
    expect(f.spentToday).toBe(dollars(40));
    expect(f.perDay).toBe(dollars(67));
    expect(f.leftToday).toBe(dollars(27));
    expect(f.leftThisMonth).toBe(dollars(1300));
  });

  it("does not count a bill paid today as today's everyday spending", () => {
    const f = freeToSpend(statuses, [bill('Power', 100, '2026-11-11', 'paid', '2026-11-11')], [tx('tx-Power', '2026-11-11', 100), tx('coffee', '2026-11-11', 5)], '2026-11', 11);
    expect(f.spentToday).toBe(dollars(5));
    expect(f.billsToCome).toBe(0);
  });

  it('counts a late bill as still to come, and ignores refunds today', () => {
    const f = freeToSpend(statuses, [bill('Phone', 80, '2026-11-03', 'late')], [tx('refund', '2026-11-11', -30)], '2026-11', 11);
    expect(f.billsToCome).toBe(dollars(80));
    expect(f.spentToday).toBe(0);
  });

  it('never goes below zero, and reports how far over the month is', () => {
    const f = freeToSpend([status('fun', 100, 150)], [bill('Power', 100, '2026-11-15', 'due')], [], '2026-11', 11);
    expect(f.perDay).toBe(0);
    expect(f.leftThisMonth).toBe(dollars(-150));
  });

  it('gives the whole remainder on the last day', () => {
    const f = freeToSpend([status('fun', 500, 100)], [], [], '2026-11', 30);
    expect(f).toMatchObject({ daysLeft: 1, perDay: dollars(400) });
  });
});

describe('monthVerdict', () => {
  const end = (mid: number, high: number) => ({ end: { day: 30, low: dollars(mid - 100), mid: dollars(mid), high: dollars(high) } });
  const free = { budget: dollars(3000), spent: dollars(1600) };
  it('is calm when the likely range finishes inside the budget', () => {
    expect(monthVerdict(free, end(2600, 2900))).toEqual({ text: 'You’re on track.', tone: 'good' });
  });
  it('warns when a heavy finish would go over', () => {
    expect(monthVerdict(free, end(2800, 3100)).tone).toBe('warn');
  });
  it('says so when the likely finish is over', () => {
    expect(monthVerdict(free, end(3200, 3500))).toEqual({ text: 'Heading over budget.', tone: 'warn' });
  });
  it('says so plainly once the budget is spent', () => {
    expect(monthVerdict({ budget: dollars(3000), spent: dollars(3001) }, end(3200, 3500))).toEqual({ text: 'Over budget this month.', tone: 'bad' });
  });
});

describe('monthAhead', () => {
  const free = { budget: dollars(3000), spent: dollars(1600) };
  it('groups unpaid bills by day with a running amount left', () => {
    const stops = monthAhead([
      bill('Rent', 1000, '2026-11-01', 'paid', '2026-11-01'),
      bill('Power', 100, '2026-11-15', 'due'), bill('Golf', 60, '2026-11-15', 'due'), bill('Phone', 85, '2026-11-22', 'due'),
    ], free, '2026-11', 11);
    expect(stops.map((s) => [s.day, s.bills.length, s.leftAfter])).toEqual([[15, 2, dollars(1240)], [22, 1, dollars(1155)]]);
  });
  it('puts a bill that is past its usual date first, as due today', () => {
    const stops = monthAhead([bill('Phone', 80, '2026-11-03', 'late'), bill('Power', 100, '2026-11-15', 'due')], free, '2026-11', 11);
    expect(stops[0]).toMatchObject({ date: '2026-11-11', late: true, leftAfter: dollars(1320) });
    expect(stops[1].leftAfter).toBe(dollars(1220));
  });
});
