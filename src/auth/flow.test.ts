import { describe, expect, it } from 'vitest';
import { authErrorMessage, authStage, friendlyError, looksLikeEmail, retryAfterSeconds } from './flow';

describe('authStage', () => {
  const base = { connected: true, ready: true, signedIn: true, currentLevel: 'aal1' as const, nextLevel: 'aal1' as const };

  it('runs on sample data only without a backend', () => {
    expect(authStage({ ...base, connected: false, signedIn: false })).toBe('preview');
  });
  it('waits for the saved session', () => {
    expect(authStage({ ...base, ready: false })).toBe('loading');
  });
  it('shows only sign-in when nobody is signed in', () => {
    expect(authStage({ ...base, signedIn: false, currentLevel: null, nextLevel: null })).toBe('signed_out');
  });
  it('asks a returning user with two-step verification to finish signing in', () => {
    expect(authStage({ ...base, nextLevel: 'aal2' })).toBe('step_up');
  });
  it('lets in a user who used their second factor', () => {
    expect(authStage({ ...base, currentLevel: 'aal2', nextLevel: 'aal2' })).toBe('signed_in');
  });
  it('lets in a new user who has not set up two-step yet (it is required later, before linking a bank)', () => {
    expect(authStage(base)).toBe('signed_in');
  });
});

describe('looksLikeEmail', () => {
  it('accepts an address and rejects partial ones', () => {
    expect(looksLikeEmail(' sam@example.com ')).toBe(true);
    expect(looksLikeEmail('sam@')).toBe(false);
    expect(looksLikeEmail('sam@example')).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it('stays quiet when the person cancelled', () => {
    expect(authErrorMessage({ code: 'ERR_REQUEST_CANCELED', message: 'The user canceled the authorization attempt' })).toBeNull();
    expect(authErrorMessage({ name: 'NotAllowedError', message: 'The operation either timed out or was not allowed.' })).toBeNull();
    expect(authErrorMessage(new Error('UserCancelled'))).toBeNull();
  });
  it('turns a rate limit into a wait time', () => {
    const e = new Error('For security purposes, you can only request this after 42 seconds.');
    expect(retryAfterSeconds(e)).toBe(42);
    expect(authErrorMessage(e)).toBe('Please wait 42 seconds, then try again.');
  });
  it('explains connection problems and bad codes', () => {
    expect(authErrorMessage(new Error('Network request failed'))).toMatch(/connection/);
    expect(authErrorMessage(new Error('Token has expired or is invalid'))).toMatch(/newest email/);
    expect(authErrorMessage({ code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' })).toMatch(/authenticator app/);
  });
  it('shows our own messages but never unknown server text', () => {
    expect(authErrorMessage(friendlyError('No passkey set up yet'))).toBe('No passkey set up yet');
    expect(authErrorMessage(new Error('pq: relation auth.x does not exist'))).toBe('Something went wrong signing in. Please try again.');
  });
});
