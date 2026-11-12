/** Passkeys in the iOS app, through the native module (development and TestFlight builds only). */
export async function passkeySupported() {
  // Loaded lazily: Expo Go lacks the native module, so there passkeys just aren't offered.
  try {
    const { Passkey } = await import('react-native-passkey');
    return Passkey.isSupported();
  } catch {
    return false;
  }
}

/** Creates (registers) a passkey. Takes and returns WebAuthn JSON. */
export async function createPasskey(publicKey: any): Promise<unknown> {
  const { Passkey } = await import('react-native-passkey');
  return Passkey.create(publicKey);
}

/** Signs in with an existing passkey. Takes and returns WebAuthn JSON. */
export async function getPasskey(publicKey: any): Promise<unknown> {
  const { Passkey } = await import('react-native-passkey');
  return Passkey.get(publicKey);
}
