# Risk register

Risks to consumer financial data and the app, rated and tracked as required by section 2 of the [information security policy](information-security-policy.md). Review it yearly, after any incident, and before shipping a feature that handles new kinds of data. Log each review in [operations.md](operations.md).

Owner: Security Owner (David). Last reviewed: 2026-11-10.

**Rating.** Likelihood and impact are each Low (1), Medium (2) or High (3). Score = likelihood × impact. Scores of 6 or more need a control in place before production; 3–4 need a control or a written acceptance; 1–2 are accepted and watched.

| # | Risk | Likelihood | Impact | Score | Controls in place | Remaining risk / next step | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | **Leaked Plaid access tokens or Plaid secret** (e.g. from code, logs or a compromised server) give someone access to users' bank data | Low | High | 3 | Tokens encrypted in Supabase Vault, read only by service-role functions, never sent to the phone or logged; Plaid secret only in Supabase secrets; gitleaks and GitHub secret scanning; incident plan rotates secrets and calls `/item/remove` | Rotate Plaid secret yearly | Mitigated |
| R2 | **Admin account takeover** (GitHub, Supabase, Plaid, Apple, Anthropic, email, DNS) through phishing or a reused password | Medium | High | 6 | Policy requires MFA, unique password-manager passwords, no shared accounts, quarterly access review | MFA must be turned on for every account (gaps.md) | Open: needs MFA rollout |
| R3 | **Consumer account takeover** leads to someone linking banks or viewing a household's transactions | Medium | High | 6 | Sign in with Apple or email code, plus authenticator-app MFA required (server-enforced) before Plaid Link; sessions in Keychain, this device only | Consider requiring the second factor for viewing data too, not just linking | Mitigated |
| R4 | **One household sees another household's data** because of a missing row-level security policy or a function bug | Low | High | 3 | Row-level security on every table; functions check `requireMember` before using the service role; CLAUDE.md rules; PR review; Supabase Security Advisor before release | Add automated RLS tests against a local Supabase | Mitigated |
| R5 | **Too much personal data sent to the AI provider** (Anthropic), or retained there | Medium | Medium | 4 | Only merchant, amount, date and bucket sent; never tokens, account numbers or passwords; cancel assistant strips typed values, emails and long numbers; API data not used for training; disclosed in privacy policy | Review prompts whenever an AI feature changes | Mitigated |
| R6 | **Cancel assistant acts wrongly on a third-party site** (prompt injection from a hostile page, or a mistaken cancellation) | Medium | Medium | 4 | Runs in a phone WebView; domain allow-list; password/payment fields are user-only; user approves the final click; outcome logged | Monitor outcomes after launch | Mitigated |
| R7 | **Vulnerable dependency** in the app or backend is exploited | Medium | Medium | 4 | Dependabot; weekly `npm audit` and CI on every change; patch critical in 7 days, high in 30 | Turn on Dependabot alerts in GitHub settings (gaps.md) | Open: needs GitHub settings |
| R8 | **Lost or compromised admin computer or phone** | Low | High | 3 | Full-disk encryption, Defender, auto-updates, screen lock; no consumer data stored locally; revoke sessions and keys on loss | Confirm BitLocker/Defender on David's PC and log it (gaps.md) | Open: needs device check |
| R9 | **Data kept longer than promised, or not deleted on request** | Low | Medium | 2 | `plaid-unlink`, `delete-account` and daily `retention` job enforce the policy | Schedule the `retention` job in Supabase (gaps.md) | Open: needs cron setup |
| R10 | **Data loss** from accidental deletion, a bad migration or a provider outage | Medium | Medium | 4 | Schema changes only via reviewed migrations; Supabase backups | Move to Supabase Pro for daily backups before production (gaps.md) | Open: needs Pro plan |
| R11 | **Forged Plaid webhook** triggers false syncs or notifications | Low | Medium | 2 | Webhook JWT (ES256) and body-hash verification, 5-minute maximum age | — | Mitigated |
| R12 | **Abuse of AI features** runs up cost or is used to probe data | Medium | Low | 2 | Per-household AI credits charged on the server; usage reviewed weekly | Set billing/usage alerts in the Anthropic Console | Accepted, watched |
| R13 | **Privacy or legal non-compliance** (privacy policy missing or inaccurate, consent not recorded) | Low | High | 3 | Privacy policy matches the data flows; consent recorded per notice version; policy reviewed yearly | Publish the privacy page (gaps.md) | Open: needs publishing |

## Review log

| Date | Change | Reviewer |
| --- | --- | --- |
| 2026-11-10 | First register, 13 risks | David |
