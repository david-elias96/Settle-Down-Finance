/**
 * Passkeys in the web app, through the browser's WebAuthn API (Face ID in Safari and in the
 * home-screen app). The relying party is settledownfinancial.com, so passkeys made in the iOS
 * app also work on app.settledownfinancial.com, and a look-alike domain can't use them.
 */
import { creationOptions, credentialJson, requestOptions } from './webauthnJson';

export async function passkeySupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function createPasskey(publicKey: any): Promise<unknown> {
  const cred = await navigator.credentials.create({ publicKey: creationOptions(publicKey) });
  if (!cred) throw new Error('Passkey was not created');
  return credentialJson(cred as any);
}

export async function getPasskey(publicKey: any): Promise<unknown> {
  const cred = await navigator.credentials.get({ publicKey: requestOptions(publicKey) });
  if (!cred) throw new Error('Passkey was not used');
  return credentialJson(cred as any);
}
