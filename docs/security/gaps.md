# Security policy gaps

Where the code or our practice does not yet meet [the information security policy](information-security-policy.md). Close every row before submitting the Plaid production questionnaire, and remove a row in the change that closes it.

Last reviewed: 2026-11-10.

## Before submitting to Plaid (David)

| To do | Why (questionnaire item) | Policy section |
| --- | --- | --- |
| Turn on MFA (authenticator app or passkey) for GitHub, Supabase, Plaid Dashboard, Anthropic Console, Expo, Apple Developer, domain registrar/DNS and email; keep passwords in a password manager | MFA for critical systems; access controls | 4 |
| Publish `site/privacy/index.html` at https://settledownfinancial.com/privacy | Privacy policy | 8 |
| Create the `admin@settledownfinancial.com` mailbox (or a forward to your inbox) | Privacy policy contact; incident reporting | 2, 8 |
| Supabase: run migration `0007`, deploy the new functions (`plaid-unlink`, `delete-account`, `retention`), enable MFA (TOTP) and Apple + email OTP providers in Auth, turn on leaked-password protection | Consumer MFA; deletion | 4, 8 |
| Supabase: set `CRON_SECRET`, and schedule `retention` daily and `daily-insights` each evening (Supabase Cron, sending `Authorization: Bearer <CRON_SECRET>`) | Retention policy enforced | 8 |
| Move the Supabase project to the Pro plan before production (daily backups, no pausing) | Backups, availability | 7 |
| GitHub: protect `main` (require pull request and the CI checks, block force-push); turn on Dependabot alerts, secret scanning and push protection | Vulnerability scanning; change management | 5, 6 |
| On your Windows PC: confirm BitLocker, Microsoft Defender and automatic Windows Update are on; log it in [operations.md](operations.md) | Vulnerability scans on employee machines | 6, 9 |

## Code still to build

| Gap | Policy section |
| --- | --- |
| Screens still read sample data; wiring Budget/Activity to Supabase queries is the next backend task. Sign-in, two-step verification, consent, bank linking, unlinking and account deletion already use the real backend when `EXPO_PUBLIC_SUPABASE_URL` is set | — |
| Register the phone's push token after sign-in (needed for retention notices and alerts) | 8 |

## Closed

| Gap | Closed in |
| --- | --- |
| `daily-insights` accepted `Bearer undefined` when `CRON_SECRET` was not set | PR #12 (fails closed, constant-time compare) |
| No sign-in; no MFA before Plaid Link | PR #12: Sign in with Apple / email code, authenticator-app MFA; backend requires AAL2 for Link tokens and token exchange |
| Session tokens storage | PR #12: Keychain via `expo-secure-store` (this device only, when unlocked) |
| No consent before Plaid Link | PR #12: data-use notice screen; consent recorded in `plaid_consents` and required by the backend |
| No unlink or account deletion | PR #12: `plaid-unlink` and `delete-account` call Plaid `/item/remove`, delete Vault secrets and data |
| No retention jobs | PR #12: `retention` function (cancel-assistant text after 30 days; inactive accounts after 24 months with notice) |
| Invite codes used `random()` | PR #12: `gen_random_bytes` with rejection sampling |
| Household members could read the cancel assistant's raw page text | PR #12: column grants hide `messages` |
| No CI or dependency scanning | PR #12: GitHub Actions (typecheck, tests, Deno check, weekly `npm audit` and gitleaks), Dependabot |
| No risk register | PR #12: `docs/security/risk-register.md` (13 risks, rated, with controls and open items) |
