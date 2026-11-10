# Settle Down Finance Access Control Policy

Version 1.1 · Effective 2026-11-10 · Owner: Security Owner (founder)

## 1. Purpose and scope

Access to Settle Down Finance's production systems and to consumer financial data is granted only on least privilege, only to named people with multi-factor authentication, and is reviewed every quarter.

This policy expands section 4 of the Settle Down Finance Information Security Policy. It covers:

- **Production systems:** the Supabase project (database, Auth, Vault, Storage, edge functions), the Plaid Dashboard, the Anthropic Console, Expo / EAS, Apple Developer and App Store Connect, the GitHub repository, the domain registrar and DNS host, website hosting, and the company email account.
- **Sensitive data:** all data classified Secret or Confidential in the Information Security Policy, including Plaid access tokens and API secrets, and consumer account, balance and transaction data.
- **Everyone with access:** the founder, any future employee or contractor, and automated services (non-human identities).

We have no physical production assets or offices with servers; all production systems are managed cloud services.

## 2. Principles

1. **Least privilege.** Each person and service gets the lowest role that does the job, for only as long as needed.
2. **Named accounts only.** Every login belongs to one person. Shared accounts and shared passwords are not allowed.
3. **Strong authentication.** MFA is required on every account with access to production or sensitive data.
4. **Separation of consumer and admin access.** App users can only reach their own household's data through the app; they never get access to production systems.
5. **Access is recorded and reviewed.** Every grant, change and removal is written down and reviewed quarterly.

## 3. Roles

Access is role-based. A person's role, not their identity, decides what they can do.

**Workforce roles**

| Role | Who | Access |
| --- | --- | --- |
| Security Owner (admin) | Founder (David Elias) | Owner/admin on all production systems; approves and records all access; holds production secrets; direct database access for maintenance and incident response only |
| Developer | Future employees or contractors who write code | GitHub write access through pull requests (no direct push to `main`); Supabase access to non-production projects only; no production secrets; no direct production database access |
| Support / read-only | Future team members who help users | Read-only dashboard roles where a vendor offers them; no access to Plaid tokens or secrets; consumer data viewed only to resolve a user's request, with the request recorded |

Only the Security Owner may hold owner or admin roles. Adding a second admin requires a written reason recorded in the access log.

**Application roles (enforced in code)**

| Role | Access |
| --- | --- |
| Anonymous | Nothing beyond sign-in |
| Signed-in user (household member) | Their own household's rows only, enforced by Postgres row-level security on every table |
| Household owner | Same as a member, plus removing members |
| Service role (backend only) | Used only inside edge functions, after the function checks the caller's session and household; holds the only path to Plaid tokens in Vault; never shipped in the app |

## 4. Authentication

**Workforce.**

- MFA is required on every production system: an authenticator app, passkey or hardware key. SMS is used only where nothing stronger is offered.
- Passwords are unique, generated and stored in a password manager protected by MFA.
- Production secrets (Plaid secret, Supabase service-role key, Anthropic API key, Expo token, cron secret) are held only in Supabase edge-function secrets or EAS secrets, never on laptops, in code, in chat or in email.

**Consumers.**

- Users sign in with Sign in with Apple or a one-time email code.
- Before Plaid Link is shown, every user must also complete a second factor, raising the session to MFA assurance level 2. The default is a passkey (WebAuthn/FIDO2 with Face ID or device passcode), which is phishing-resistant because it only works with settledownfinancial.com. An authenticator app (TOTP) is available as a fallback. The backend refuses to create a Plaid Link token or exchange a public token for any session below that level.
- App sessions are short-lived JSON Web Tokens stored only in the iOS Keychain (this device only, available when unlocked).

**Non-human (service) identities.**

- Services authenticate with signed tokens or API keys over TLS 1.2+: Supabase JWTs for app and function calls, Plaid client credentials held only server-side, and ES256-signed JWTs on Plaid webhooks, which we verify along with a hash of the body and a 5-minute maximum age.
- Scheduled jobs authenticate with a dedicated secret, checked in constant time, and fail closed if the secret is not set.
- Each service credential has a single purpose and is stored only in the platform's secret store.

## 5. Granting, changing and removing access

1. **Request.** The need, the system and the role are written in the access log (`docs/security/operations.md`).
2. **Approve.** The Security Owner approves, choosing the lowest role that works. The person reads and accepts the Information Security Policy before access is granted.
3. **Grant.** The account is created as a named login with MFA turned on before first use.
4. **Change.** A change of duties is handled as a new request; access no longer needed is removed at the same time.
5. **Remove.** When someone leaves or no longer needs access, all of their accounts are disabled the same day. Any secret they could have seen is rotated, and their app and dashboard sessions are revoked. Removal is recorded in the access log.

## 6. Reviews and audits

- **Quarterly:** the Security Owner reviews every account on every production system against the access log, confirms MFA is on, removes anything not needed, and records the review.
- **Yearly:** production secrets are rotated, and this policy is reviewed with the Information Security Policy.
- **Before each release:** the Supabase Security Advisor is checked for row-level security and permission issues.
- **Code changes:** any change that affects authentication, row-level security, roles or secrets is reviewed in a pull request against these rules, and automated checks must pass before merge.

## 7. Data access rules

- Production consumer data is never browsed out of curiosity. It is accessed only to operate the service, to fix a problem a user reported, or to respond to an incident.
- Consumer data is not copied to laptops, spreadsheets, test data or the code repository.
- Plaid access tokens are never displayed, exported or sent to the app; only backend functions read them from Vault.
- Development and testing use Plaid Sandbox and sample data.

## 8. Logging

Supabase records authentication, API and function logs; GitHub, Plaid, Apple and Anthropic keep account audit logs. The Security Owner reviews failed sign-ins, new admin accounts and unusual access weekly.

## 9. Exceptions and enforcement

An exception needs a written reason, compensating controls and an end date, approved by the Security Owner and reviewed quarterly. Breaking this policy can lead to removal of access and, for employees and contractors, termination of the relationship.

## Revision history

| Version | Date | Change | Approved by |
| --- | --- | --- | --- |
| 1.1 | 2026-11-10 | Passkeys added as the default consumer second factor | David Elias, Security Owner |
| 1.0 | 2026-11-10 | First version | David Elias, Security Owner |
