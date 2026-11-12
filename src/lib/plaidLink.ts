/** What Plaid Link hands back: a one-time public token (exchanged by the backend), or null if the person closed it. */
export type PlaidLinkResult = { publicToken: string; institutionName: string | null } | null;

/** Opens Plaid Link with the native SDK (development and TestFlight builds; not Expo Go). */
export async function openPlaidLink({ token }: { token: string; householdId: string; receivedRedirectUri?: string }): Promise<PlaidLinkResult> {
  // Loaded lazily: Plaid's native SDK exists only in development and TestFlight builds.
  const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
  return new Promise((resolve, reject) => {
    createPlaidLinkSession({
      token,
      onSuccess: (s) => resolve({ publicToken: s.publicToken, institutionName: s.metadata.institution?.name ?? null }),
      onExit: () => resolve(null),
      onEvent: () => {},
    }).then((session) => session.open()).catch(reject);
  });
}

/** Native builds finish bank OAuth inside the SDK, so there is never a redirect to resume. */
export function pendingOAuthReturn(): { token: string; householdId: string } | null {
  return null;
}
