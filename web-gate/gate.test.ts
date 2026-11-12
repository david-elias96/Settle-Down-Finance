import { describe, expect, it } from 'vitest';
import { cookieHeader, gatePage, isOpenPath, makeToken, passwordMatches, readCookie, safeNext, tokenValid } from './gate';

describe('web password gate', () => {
  it('accepts only the right password', async () => {
    expect(await passwordMatches('open sesame', 'open sesame')).toBe(true);
    expect(await passwordMatches('open sesam', 'open sesame')).toBe(false);
    expect(await passwordMatches('', 'open sesame')).toBe(false);
  });

  it('issues a cookie token that checks out until it expires', async () => {
    const now = 1_700_000_000_000;
    const token = await makeToken('s3cret', now);
    expect(await tokenValid(token, 's3cret', now + 1000)).toBe(true);
    expect(await tokenValid(token, 's3cret', now + 91 * 864e5)).toBe(false);
  });

  it('rejects tokens after the password changes, or when tampered with', async () => {
    const token = await makeToken('old');
    expect(await tokenValid(token, 'new')).toBe(false);
    const [exp, sig] = token.split('.');
    expect(await tokenValid(`${Number(exp) + 1e9}.${sig}`, 'old')).toBe(false);
    expect(await tokenValid('garbage', 'old')).toBe(false);
    expect(await tokenValid(undefined, 'old')).toBe(false);
  });

  it('only redirects within the site', () => {
    expect(safeNext('/activity?x=1')).toBe('/activity?x=1');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('/__gate')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });

  it('leaves only the manifest and icons open', () => {
    expect(isOpenPath('/manifest.webmanifest')).toBe(true);
    expect(isOpenPath('/icons/icon-192.png')).toBe(true);
    expect(isOpenPath('/')).toBe(false);
    expect(isOpenPath('/_expo/static/js/web/entry.js')).toBe(false);
    expect(isOpenPath('/sw.js')).toBe(false);
  });

  it('reads the cookie and sets it HttpOnly and Secure', () => {
    expect(readCookie('a=1; sd_gate=abc.def; b=2', 'sd_gate')).toBe('abc.def');
    expect(readCookie(null, 'sd_gate')).toBeUndefined();
    expect(cookieHeader('t')).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  it('escapes the return path in the page', () => {
    expect(gatePage('/"><script>')).not.toContain('<script>');
  });
});
