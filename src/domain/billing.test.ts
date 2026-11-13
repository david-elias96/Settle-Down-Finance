import { describe, expect, it } from 'vitest';
import { billingFromRow, billingSummary, daysUntil, needsPlan, parsePlan } from './billing';

const row = (over: Record<string, unknown> = {}) => ({
  access: false, reason: 'none', enforced: true, status: 'none', plan: null, trial_end: null,
  current_period_end: null, cancel_at_period_end: false, trial_days: 7, can_trial: true, ...over,
});
const now = new Date('2026-11-12T12:00:00Z');

describe('parsePlan', () => {
  it('reads yearly and defaults everything else to monthly', () => {
    expect(parsePlan('monthly')).toBe('monthly');
    expect(parsePlan('yearly')).toBe('yearly');
    expect(parsePlan('free')).toBe('monthly');
    expect(parsePlan(undefined)).toBe('monthly');
  });
});

describe('billingFromRow', () => {
  it('fails closed on missing or odd values', () => {
    expect(billingFromRow(null)).toBeNull();
    expect(billingFromRow(row({ access: true, reason: 'hacked' }))?.access).toBe(false);
    expect(billingFromRow(row({ access: 'yes', reason: 'comp' }))?.access).toBe(false);
  });
  it('keeps a valid row', () => {
    const b = billingFromRow(row({ access: true, reason: 'subscribed', status: 'active', plan: 'yearly' }))!;
    expect(b).toMatchObject({ access: true, reason: 'subscribed', plan: 'yearly', enforced: true });
  });
});

describe('needsPlan', () => {
  it('sends people to plans only when the paywall is on and they have no access', () => {
    expect(needsPlan(billingFromRow(row()))).toBe(true);
    expect(needsPlan(billingFromRow(row({ enforced: false, access: true, reason: 'open' })))).toBe(false);
    expect(needsPlan(billingFromRow(row({ access: true, reason: 'comp' })))).toBe(false);
    expect(needsPlan(null)).toBe(false);
  });
});

describe('billingSummary', () => {
  it('describes founder access', () => {
    expect(billingSummary(billingFromRow(row({ access: true, reason: 'comp' }))!, now).title).toBe('Founder access');
  });
  it('counts trial days and names the first charge', () => {
    const s = billingSummary(billingFromRow(row({ access: true, reason: 'subscribed', status: 'trialing', plan: 'yearly', trial_end: '2026-11-19T12:00:00Z' }))!, now);
    expect(s.title).toBe('Free trial · 7 days left');
    expect(s.detail).toContain('$49.99/year');
  });
  it('says a cancelled trial won’t be charged', () => {
    const s = billingSummary(billingFromRow(row({ access: true, reason: 'subscribed', status: 'trialing', trial_end: '2026-11-13T12:00:00Z', cancel_at_period_end: true }))!, now);
    expect(s.title).toBe('Free trial · 1 day left');
    expect(s.detail).toContain("won't be charged");
  });
  it('shows renewals, cancellations and failed payments', () => {
    expect(billingSummary(billingFromRow(row({ access: true, reason: 'subscribed', status: 'active', plan: 'monthly', current_period_end: '2026-12-01T12:00:00Z' }))!, now))
      .toEqual({ title: 'Monthly plan · $5.99/month', detail: 'Renews Dec 1.' });
    expect(billingSummary(billingFromRow(row({ access: true, reason: 'subscribed', status: 'active', plan: 'monthly', current_period_end: '2026-12-01T12:00:00Z', cancel_at_period_end: true }))!, now).detail)
      .toBe('Cancelled. Access until Dec 1.');
    expect(billingSummary(billingFromRow(row({ access: true, reason: 'subscribed', status: 'past_due' }))!, now).title).toBe('Payment didn’t go through');
  });
  it('offers the trial only once', () => {
    expect(billingSummary(billingFromRow(row())!, now).detail).toContain('7-day free trial');
    expect(billingSummary(billingFromRow(row({ can_trial: false }))!, now).detail).toBe('Pick a plan to keep using Settle Down.');
  });
});

describe('daysUntil', () => {
  it('rounds up and never goes negative', () => {
    expect(daysUntil('2026-11-12T13:00:00Z', now)).toBe(1);
    expect(daysUntil('2026-11-01T00:00:00Z', now)).toBe(0);
  });
});
