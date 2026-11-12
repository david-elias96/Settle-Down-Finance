import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { allowedOrigins, corsHeaders } from './cors.ts';

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
  const { count } = await admin.from('household_members').select('*', { count: 'exact', head: true })
    .eq('household_id', householdId).eq('user_id', data.user.id);
  if (!count) throw new HttpError(403, 'Not a member of this household');
  return { userId: data.user.id };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

const WEB_ORIGINS = allowedOrigins(Deno.env.get('APP_WEB_ORIGINS'));

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    // The web app's browser asks first (CORS preflight); only our own web origin is allowed.
    const cors = corsHeaders(req.headers.get('Origin'), WEB_ORIGINS);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await fn(req);
    } catch (e) {
      if (e instanceof HttpError) res = json({ error: e.message, ...e.extra }, e.status);
      else {
        console.error(e);
        res = json({ error: 'Internal error' }, 500);
      }
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  };
}
