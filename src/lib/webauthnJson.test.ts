import { describe, expect, it } from 'vitest';
import { creationOptions, credentialJson, fromB64url, requestOptions, toB64url } from './webauthnJson';

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

describe('WebAuthn JSON conversion', () => {
  it('round-trips base64url without padding', () => {
    const buf = bytes(251, 255, 0, 1);
    expect(toB64url(buf)).toBe('-_8AAQ');
    expect(new Uint8Array(fromB64url('-_8AAQ'))).toEqual(new Uint8Array(buf));
  });

  it('decodes the binary fields of creation and request options', () => {
    const c = creationOptions({ challenge: 'AQID', rp: { id: 'settledownfinancial.com' }, user: { id: 'BAU', name: 'n' }, excludeCredentials: [{ id: 'Bg', type: 'public-key' }] });
    expect(new Uint8Array(c.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(c.user.id as ArrayBuffer)).toEqual(new Uint8Array([4, 5]));
    expect(c.rp.id).toBe('settledownfinancial.com');
    const r = requestOptions({ challenge: 'AQID', allowCredentials: [{ id: 'Bg', type: 'public-key' }] });
    expect(new Uint8Array(r.allowCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([6]));
  });

  it('serializes a registration and an assertion', () => {
    const reg = credentialJson({ id: 'Bg', rawId: bytes(6), type: 'public-key', authenticatorAttachment: 'platform',
      response: { clientDataJSON: bytes(1), attestationObject: bytes(2), getTransports: () => ['internal'] } });
    expect(reg).toMatchObject({ rawId: 'Bg', response: { clientDataJSON: 'AQ', attestationObject: 'Ag', transports: ['internal'] }, clientExtensionResults: {} });
    const auth = credentialJson({ id: 'Bg', rawId: bytes(6), type: 'public-key',
      response: { clientDataJSON: bytes(1), authenticatorData: bytes(2), signature: bytes(3), userHandle: bytes(4) } });
    expect(auth.response).toEqual({ clientDataJSON: 'AQ', authenticatorData: 'Ag', signature: 'Aw', userHandle: 'BA' });
  });
});
