/**
 * Converts between WebAuthn's JSON form (base64url strings, what Supabase Auth sends and expects)
 * and the browser's binary form (ArrayBuffers), for passkeys in the web app.
 */

export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function toB64url(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Descriptor = { id: string; type: string; transports?: string[] };

/** Creation options (JSON) → PublicKeyCredentialCreationOptions. */
export function creationOptions(json: any): PublicKeyCredentialCreationOptions {
  return {
    ...json,
    challenge: fromB64url(json.challenge),
    user: { ...json.user, id: fromB64url(json.user.id) },
    excludeCredentials: (json.excludeCredentials ?? []).map((c: Descriptor) => ({ ...c, id: fromB64url(c.id) })),
  };
}

/** Request options (JSON) → PublicKeyCredentialRequestOptions. */
export function requestOptions(json: any): PublicKeyCredentialRequestOptions {
  return {
    ...json,
    challenge: fromB64url(json.challenge),
    allowCredentials: (json.allowCredentials ?? []).map((c: Descriptor) => ({ ...c, id: fromB64url(c.id) })),
  };
}

type Cred = {
  id: string; rawId: ArrayBuffer; type: string; authenticatorAttachment?: string | null;
  response: {
    clientDataJSON: ArrayBuffer;
    attestationObject?: ArrayBuffer; getTransports?: () => string[];
    authenticatorData?: ArrayBuffer; signature?: ArrayBuffer; userHandle?: ArrayBuffer | null;
  };
  getClientExtensionResults?: () => unknown;
};

/** A credential from navigator.credentials.create/get → WebAuthn JSON (RegistrationResponseJSON / AuthenticationResponseJSON). */
export function credentialJson(cred: Cred) {
  const r = cred.response;
  const response: Record<string, unknown> = { clientDataJSON: toB64url(r.clientDataJSON) };
  if (r.attestationObject) {
    response.attestationObject = toB64url(r.attestationObject);
    response.transports = r.getTransports?.() ?? [];
  } else {
    response.authenticatorData = toB64url(r.authenticatorData!);
    response.signature = toB64url(r.signature!);
    if (r.userHandle) response.userHandle = toB64url(r.userHandle);
  }
  return {
    id: cred.id, rawId: toB64url(cred.rawId), type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    response, clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
  };
}
