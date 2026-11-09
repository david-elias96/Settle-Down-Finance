/**
 * Subscription-cancelling agent: shared protocol and safety rules.
 *
 * The browser runs on the user's phone (an in-app WebView). The phone sends Claude a
 * text snapshot of the page (with every typed value and anything sensitive removed),
 * Claude answers with one action, and the phone carries it out. The user logs in
 * themselves, so passwords and card numbers never leave the phone, and the phone
 * enforces the rules below whatever the model or the web page says.
 */
import { vendorKey } from './filters';

export interface PageElement {
  /** Short id the page script stamps on the element (data-sdf). */
  id: string;
  tag: string;
  role?: string;
  type?: string;
  text: string;
  checked?: boolean;
  disabled?: boolean;
  /** Password, card, or other sensitive field: the agent may not type into it. */
  sensitive?: boolean;
  href?: string;
  options?: string[];
}

export interface PageSnapshot {
  url: string;
  title: string;
  /** Visible page text, trimmed, with emails and long numbers masked. */
  text: string;
  elements: PageElement[];
  hasPasswordField: boolean;
}

export type HandoffReason = 'login' | 'two_factor' | 'captcha' | 'other';
export type CancelOutcome = 'cancelled' | 'already_cancelled' | 'billed_elsewhere' | 'not_found' | 'failed';

export type AgentAction =
  | { kind: 'click'; elementId: string; why: string; finalCancel: boolean }
  | { kind: 'type'; elementId: string; text: string; why: string }
  | { kind: 'choose'; elementId: string; option: string; why: string }
  | { kind: 'scroll'; direction: 'up' | 'down'; why: string }
  | { kind: 'go_to'; url: string; why: string }
  | { kind: 'go_back'; why: string }
  | { kind: 'hand_to_user'; reason: HandoffReason; message: string }
  | { kind: 'finish'; outcome: CancelOutcome; summary: string; confirmation: string | null; endsOn: string | null };

/** What happened when the phone tried the last action. */
export interface ActionResult {
  ok: boolean;
  /** Why the phone refused or what went wrong, in plain words. */
  note?: string;
  snapshot: PageSnapshot;
}

/** Hosts the agent may visit: the service's own domains and their subdomains. */
export function isAllowedUrl(url: string, allowedDomains: string[]): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

const SENSITIVE = /pass|pwd|card|cvv|cvc|csc|ssn|social|security.?code|routing|account.?number|pin\b|otp|one.?time|verification.?code/i;

/** Fields only the user may fill in: passwords, payment details, one-time codes. */
export function isSensitiveField(f: { type?: string; name?: string; autocomplete?: string; label?: string }): boolean {
  if (f.type === 'password') return true;
  if (f.autocomplete && /^(cc-|current-password|new-password|one-time-code)/.test(f.autocomplete)) return true;
  return SENSITIVE.test(`${f.name ?? ''} ${f.label ?? ''}`);
}

/** Masks emails and long digit runs (card, phone and account numbers) in page text. */
export function redactText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b(?:\d[ -]?){6,}\d\b/g, '[number]');
}

/**
 * Checks an action against the rules before the phone runs it. Returns a reason when
 * it must be refused; the refusal is sent back to the agent as the action's result.
 */
export function checkAction(action: AgentAction, page: PageSnapshot, allowedDomains: string[]): string | null {
  const el = 'elementId' in action ? page.elements.find((e) => e.id === action.elementId) : undefined;
  switch (action.kind) {
    case 'click':
    case 'choose':
      if (!el) return `There's no element ${action.elementId} on this page any more.`;
      if (el.href && !isAllowedUrl(new URL(el.href, page.url).toString(), allowedDomains)) return 'That link leaves the service\'s website.';
      return null;
    case 'type':
      if (!el) return `There's no element ${action.elementId} on this page any more.`;
      if (el.sensitive) return 'Only the user may type into password, payment or code fields. Hand over to the user instead.';
      if (action.text.length > 300) return 'Text is too long.';
      return null;
    case 'go_to':
      return isAllowedUrl(action.url, allowedDomains) ? null : 'That address is outside the service\'s website.';
    default:
      return null;
  }
}

export interface CancelGuide {
  name: string;
  /** Page to start on (usually the account or cancel page). */
  startUrl: string;
  /** Domains the agent may visit, including the service's login domain. */
  domains: string[];
  /** Things worth knowing before cancelling. */
  note?: string;
}

/** Common subscriptions, keyed by vendorKey of how they appear on bank statements. */
export const CANCEL_GUIDES: Record<string, CancelGuide> = {
  netflix: { name: 'Netflix', startUrl: 'https://www.netflix.com/cancelplan', domains: ['netflix.com'] },
  hulu: { name: 'Hulu', startUrl: 'https://secure.hulu.com/account', domains: ['hulu.com'] },
  'disney plus': { name: 'Disney+', startUrl: 'https://www.disneyplus.com/account', domains: ['disneyplus.com'] },
  max: { name: 'Max', startUrl: 'https://auth.max.com/subscription', domains: ['max.com'] },
  spotify: { name: 'Spotify', startUrl: 'https://www.spotify.com/account/subscription/', domains: ['spotify.com'] },
  adobe: { name: 'Adobe', startUrl: 'https://account.adobe.com/plans', domains: ['adobe.com'], note: 'Annual plans paid monthly may charge an early cancellation fee.' },
  'youtube premium': { name: 'YouTube Premium', startUrl: 'https://www.youtube.com/paid_memberships', domains: ['youtube.com', 'google.com'] },
  'amazon prime': { name: 'Amazon Prime', startUrl: 'https://www.amazon.com/mc', domains: ['amazon.com'] },
  peacock: { name: 'Peacock', startUrl: 'https://www.peacocktv.com/account/plans', domains: ['peacocktv.com'] },
  paramount: { name: 'Paramount+', startUrl: 'https://www.paramountplus.com/account/', domains: ['paramountplus.com'] },
  'planet fitness': { name: 'Planet Fitness', startUrl: 'https://www.planetfitness.com/my-account', domains: ['planetfitness.com'], note: 'Some clubs only accept cancellations in person or by letter.' },
  doordash: { name: 'DashPass', startUrl: 'https://www.doordash.com/consumer/membership/', domains: ['doordash.com'] },
  'uber one': { name: 'Uber One', startUrl: 'https://account.uber.com/', domains: ['uber.com'] },
  audible: { name: 'Audible', startUrl: 'https://www.audible.com/account/overview', domains: ['audible.com', 'amazon.com'] },
};

/** Statement names that mean Apple bills it: cancel from iPhone Settings instead. */
const APPLE_BILLED = /^(apple(\.com)?(\/bill)?|itunes)/i;

export type CancelRoute =
  | { via: 'apple' }
  | { via: 'agent'; guide: CancelGuide; known: boolean };

/** Decides how a subscription gets cancelled. Unknown services start from their website, which the user confirms. */
export function cancelRoute(vendor: string, website?: string): CancelRoute | null {
  if (APPLE_BILLED.test(vendor.trim())) return { via: 'apple' };
  const key = vendorKey(vendor);
  const match = Object.entries(CANCEL_GUIDES).find(([k]) => new RegExp(`(^|[^a-z])${k.replace(/ /g, '[ .+-]?')}([^a-z]|$)`).test(key));
  if (match) return { via: 'agent', guide: match[1], known: true };
  if (!website) return null;
  try {
    const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
    return { via: 'agent', known: false, guide: { name: vendor.trim(), startUrl: `https://${host}/`, domains: [host] } };
  } catch {
    return null;
  }
}
