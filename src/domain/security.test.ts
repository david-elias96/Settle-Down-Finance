import { describe, expect, it } from 'vitest';
import { CONSENT_NOTICE_VERSION, inactiveAccountAction, plaidLinkGate } from './security';

describe('plaidLinkGate', () => {
  const ok = { signedIn: true, aal: 'aal2' as const, consents: [CONSENT_NOTICE_VERSION] };
  it('opens only when signed in, second factor used and notice accepted', () => {
    expect(plaidLinkGate(ok)).toEqual({ ok: true });
  });
  it('asks for sign-in first', () => {
    expect(plaidLinkGate({ ...ok, signedIn: false, aal: null })).toEqual({ ok: false, next: 'sign_in' });
  });
  it('requires a second factor even after Sign in with Apple', () => {
    expect(plaidLinkGate({ ...ok, aal: 'aal1' })).toEqual({ ok: false, next: 'second_factor' });
  });
  it('requires consent to the current notice version', () => {
    expect(plaidLinkGate({ ...ok, consents: ['2020-01-01'] })).toEqual({ ok: false, next: 'consent' });
  });
});

describe('inactiveAccountAction', () => {
  const last = new Date('2024-01-15T00:00:00Z');
  it('does nothing before the notice window', () => {
    expect(inactiveAccountAction(last, null, new Date('2025-12-01T00:00:00Z'))).toBe('none');
  });
  it('warns 30 days before the 24-month mark', () => {
    expect(inactiveAccountAction(last, null, new Date('2025-12-20T00:00:00Z'))).toBe('warn');
  });
  it('waits a full 30 days after the warning before deleting', () => {
    const warned = new Date('2026-01-10T00:00:00Z');
    expect(inactiveAccountAction(last, warned, new Date('2026-01-20T00:00:00Z'))).toBe('none');
    expect(inactiveAccountAction(last, warned, new Date('2026-02-10T00:00:00Z'))).toBe('delete');
  });
  it('ignores a warning sent before the latest sign-in', () => {
    expect(inactiveAccountAction(last, new Date('2023-12-01T00:00:00Z'), new Date('2026-02-10T00:00:00Z'))).toBe('warn');
  });
});
