import type { ActionResult, AgentAction } from '@/src/domain';

/** Calls the `cancel-agent` backend function. Needs EXPO_PUBLIC_SUPABASE_URL and a signed-in user. */
const API = process.env.EXPO_PUBLIC_SUPABASE_URL;

export const agentBackendAvailable = (accessToken?: string) => !!(API && accessToken);

async function call<T>(accessToken: string, body: object): Promise<T> {
  const res = await fetch(`${API}/functions/v1/cancel-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong'), { code: data.error, credits: data.credits });
  return data as T;
}

export interface StartedSession { sessionId: string; serviceName: string; startUrl: string; domains: string[]; note: string | null }

export const startCancel = (accessToken: string, householdId: string, vendor: string, website?: string) =>
  call<StartedSession>(accessToken, { op: 'start', householdId, vendor, website });

export const nextAction = (accessToken: string, sessionId: string, result: ActionResult) =>
  call<{ action: AgentAction }>(accessToken, { op: 'step', sessionId, result }).then((r) => r.action);

export const stopCancel = (accessToken: string, sessionId: string) => call(accessToken, { op: 'stop', sessionId });
