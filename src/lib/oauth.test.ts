import { describe, expect, it } from 'vitest';
import { handoffRedirect, oauthParams } from './oauth';

describe('oauthParams', () => {
  it('reads the PKCE code from the query', () => {
    expect(oauthParams('settledown://auth-callback?code=abc123').get('code')).toBe('abc123');
  });
  it('reads errors from the fragment as well', () => {
    const p = oauthParams('exp://u.exp.direct/--/auth-callback#error=access_denied&error_description=User+cancelled');
    expect(p.get('error')).toBe('access_denied');
    expect(p.get('error_description')).toBe('User cancelled');
  });
  it('is empty when there are no parameters', () => {
    expect([...oauthParams('settledown://auth-callback').keys()]).toEqual([]);
  });
});

describe('handoffRedirect', () => {
  it('sends Supabase to our website with the app address encoded', () => {
    expect(handoffRedirect('exp://abc.on.expo.app/--/auth-callback'))
      .toBe('https://settledownfinancial.com/auth-callback/?app=exp%3A%2F%2Fabc.on.expo.app%2F--%2Fauth-callback');
  });
});
