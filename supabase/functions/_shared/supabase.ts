import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { needsSecondFactor } from './mfa.ts';

/** Service-role client: bypasses RLS. Only use after checking the caller's household. */
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Resolves the signed-in user from the request and checks they belong to `householdId`. */
export async function requireMember(req: Request, householdId: string): Promise<{ userId: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Not signed in');
  // Once someone has set up a second factor, every request must come from a session that used it.
  if (needsSecondFactor(data.user.factors ?? [], token)) {
    throw new HttpError(403, 'Two-step verification required', { next: 'second_factor' });
  }
  const { count } = await admin.from('household_members').select('*', { count: 'exact', head: true })
    .eq('household_id', householdId).eq('user_id', data.user.id);
  if (!count) throw new HttpError(403, 'Not a member of this household');
  return { userId: data.user.id };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: 'Internal error' }, 500);
    }
  };
}
