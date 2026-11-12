// Second-factor rule shared by the functions the app calls (policy section 4).

/** True when the user has a verified second factor but this (already verified) token is not AAL2. */
export function needsSecondFactor(factors: { status: string }[], token: string): boolean {
  if (!factors.some((f) => f.status === 'verified')) return false;
  return tokenAal(token) !== 'aal2';
}

function tokenAal(token: string): string | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return JSON.parse(json).aal;
  } catch {
    return undefined;
  }
}
