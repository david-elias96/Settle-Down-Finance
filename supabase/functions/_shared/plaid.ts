/** Minimal Plaid REST client. PLAID_ENV is 'sandbox' or 'production'. */
const env = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const base = `https://${env}.plaid.com`;

export async function plaid<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('PLAID_CLIENT_ID'),
      secret: Deno.env.get('PLAID_SECRET'),
      ...body,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Plaid ${path} failed: ${data.error_code} ${data.error_message}`);
  return data as T;
}

/** Plaid amounts are dollars (positive = money out). Convert to integer cents. */
export const toCents = (amount: number) => Math.round(amount * 100);
