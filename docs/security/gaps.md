# Security policy gaps

Where the code or our practice does not yet meet [the information security policy](information-security-policy.md). Everything here must be closed before real users (beyond our own household) connect banks through Plaid Production. Remove a row in the pull request that closes it.

Last reviewed: 2026-11-10.

## Code to build

| Gap | Policy section | What "done" looks like |
| --- | --- | --- |
| No sign-in yet; the app runs on sample data | 4 | Supabase Auth with Sign in with Apple, or email plus authenticator-app MFA, required before Plaid Link opens |
| Session storage | 4, 5 | Supabase client on the phone uses `expo-secure-store` (Keychain) as its auth storage, not AsyncStorage |
| No unlink flow | 8 | An edge function, callable only by the member who linked the bank, that calls Plaid `/item/remove`, deletes the Vault secret, and deletes the `plaid_items` row (accounts and transactions cascade) |
| No account deletion | 8 | In-app "Delete my account" that removes the user's Plaid items, Vault secrets, household membership and data (household deleted when its last member leaves), then the auth user. Also required by the App Store |
| Vault secrets are not deleted when an item goes away | 5, 8 | A `delete_plaid_token(secret_id)` helper (service role only) used by unlink, account deletion and incident containment |
| No retention jobs | 8 | Scheduled job that clears `cancel_sessions.messages` after 30 days and handles 24-month inactive accounts |
| Consent screen before Plaid Link | 8 | A short screen explaining Plaid and how the data is used, with links to our privacy policy and Plaid's, before Link opens |
| Invite codes use `random()` | 4 | Generate codes from `gen_random_bytes` (pgcrypto) so they are not predictable |
| Household members can read the cancel assistant's raw conversation through RLS | 3 | Expose only outcome fields to the app (a view, or move `messages` to a table with no app policy) |
| No CI | 6 | GitHub Actions running typecheck, `npm test` and `deno test` on every pull request, required to merge |

## Account and process settings (David)

| Gap | Policy section |
| --- | --- |
| Turn on MFA (authenticator app or passkey) for GitHub, Supabase, Plaid, Anthropic, Expo, Apple, domain registrar and email; store passwords in a password manager | 4 |
| Protect `main` on GitHub (require pull request, block force-push) and turn on Dependabot alerts, secret scanning and push protection | 5, 6 |
| Create `security@settledownfinance.com` | 2 |
| Publish a privacy policy at settledownfinance.com/privacy | 8 |
| Move the Supabase project to a paid plan before production (daily backups, no pausing) and enable leaked-password protection and MFA in Supabase Auth | 4, 7 |
| Turn on BitLocker, Defender and automatic updates on the Windows PC used for admin work | 9 |
| Set `CRON_SECRET` in Supabase secrets and use it in the scheduler that calls `daily-insights` | 4 |
| Start the risk register (`docs/security/risk-register.md`) and the access review log | 2, 4 |

## Closed

| Gap | Closed in |
| --- | --- |
| `daily-insights` accepted `Bearer undefined` when `CRON_SECRET` was not set | This policy's pull request (now fails closed) |
