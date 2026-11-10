# Settle Down Finance Information Security Policy

Version 1.2 · Effective 2026-11-10 · Owner: Security Owner (founder)

> This is the repository copy of the policy submitted to Plaid. Engineering rules that follow from it are summarized in `CLAUDE.md`, and known gaps between this policy and the current code are tracked in [`gaps.md`](gaps.md). Change this file only through a reviewed pull request, and add a row to the revision history.

## 1. Purpose and scope

Settle Down Finance protects the consumer financial data it receives from Plaid and from its users with the controls in this policy, and every person and system that touches that data must follow it.

**Company.** Settle Down Finance (settledownfinancial.com) is an iPhone budgeting app for households. It is operated by a small team and is currently used by the founders' own household, with a commercial launch planned.

**In scope.**

- The Settle Down Finance iOS app (Expo / React Native, built and signed with Expo EAS).
- The production backend on Supabase: Postgres database, Supabase Auth, Supabase Vault, Supabase Storage and Deno edge functions.
- All consumer data, including data received from Plaid (account names and masks, balances, transactions, Plaid access tokens and item ids).
- Third-party services that process that data: Plaid, Supabase, Anthropic (Claude API), Expo (EAS builds and push), Apple (App Store, TestFlight, push notifications) and GitHub (source code).
- The people with access to any of the above, and the computers and phones they use to reach it.

**Review.** The Security Owner reviews this policy at least once every 12 months, after any security incident, and before any material change to how consumer financial data is collected, stored or shared. Each review is recorded in the revision history at the end of this document.

## 2. Governance and roles

The founder, David Elias, is the Security Owner and is accountable for this policy, for risk decisions and for incident response.

| Role | Who | Responsibilities |
| --- | --- | --- |
| Security Owner | David Elias (founder) | Owns this policy; approves access; reviews access quarterly; runs incident response; owns vendor relationships and Plaid compliance |
| Team member | Anyone granted production access | Follows this policy; uses MFA; reports suspected incidents immediately |
| End user | App users | Sign in to the app; consent to connect accounts through Plaid Link; may revoke access or delete their data at any time |

**Risk management.** The Security Owner keeps a written risk register in the source repository. At each annual review, and before launching any feature that handles new kinds of consumer data, the Security Owner lists the risks to that data, rates their likelihood and impact, and records the control or accepted residual risk for each.

**Security contact.** Security issues and privacy requests are sent to admin@settledownfinancial.com, which is monitored by the Security Owner.

**Operations.** Recurring tasks in this policy (log reviews, device patch checks, access reviews, secret rotation, training, tabletop exercises) are listed with their frequency in `docs/security/operations.md`, and each completed task is logged there.

**Personnel.** Before anyone is given access to production systems or consumer data, the Security Owner confirms their identity, has them read and accept this policy, and records the access granted. Access is removed on the same day a person leaves or no longer needs it.

## 3. Data classification and handling

All data is classified into one of three levels, and the strictest handling rules apply to Plaid credentials and consumer financial data.

| Level | Examples | Where it may live | Rules |
| --- | --- | --- | --- |
| Secret | Plaid access tokens, Plaid client secret, Supabase service-role key, Anthropic API key, Expo and Apple signing credentials, cron secrets | Plaid access tokens: Supabase Vault only. Other secrets: Supabase edge-function secrets, EAS secrets, or a password manager | Never in source code, the app bundle, logs, tickets, chat or email. Never sent to the phone. Read only by backend code running with the service role |
| Confidential | Account names and masks, balances, transactions, receipts, budgets, household members, email addresses, push tokens | Supabase Postgres (row-level security on) and the user's own device | Only the user's own household can read it. Never copied to personal devices, spreadsheets, test fixtures or the source repository. Sent to a vendor only as listed in section 7 |
| Internal | Source code, designs, aggregate usage metrics with no personal data | GitHub (private repository), company accounts | Shared only with people who have access under this policy |

**Minimum necessary.** The app requests only the Plaid Transactions product, 90 days of history at first link, and only United States institutions. New Plaid products or longer history require a documented reason and an update to this policy.

**Test data.** Development and testing use Plaid Sandbox and the app's built-in sample data. Real consumer data is never used in development, tests, screenshots or demos without that person's written permission, and is never committed to the repository.

## 4. Access control

Access to production systems and consumer data is granted on least privilege, requires multi-factor authentication everywhere it is offered, and is reviewed every quarter.

**Administrative access (team).**

- Every account with access to production or source code uses a unique named login (no shared accounts) and phishing-resistant or app-based MFA. This covers GitHub, Supabase, Plaid Dashboard, Anthropic Console, Expo, Apple Developer / App Store Connect, the domain registrar and DNS host, and the company email account. SMS is used only where nothing stronger is offered.
- Passwords are unique, generated, and kept in a password manager protected by MFA.
- Only the Security Owner holds owner or admin roles. Anyone else gets the lowest role that does their job, and only for as long as they need it.
- Direct access to the production database (SQL editor, connection strings, service-role key) is limited to the Security Owner and used only for maintenance or incident response, never to browse consumer data.
- The Security Owner reviews every account with production access each quarter and removes any that are no longer needed. Access is revoked on the day a person leaves.

**Application access (consumers).**

- Users sign in through Supabase Auth with Sign in with Apple or a one-time code sent to their email. Before Plaid Link is surfaced, every user must also complete a second factor in that session, which raises it to assurance level AAL2 (Supabase Auth MFA). The default second factor is a passkey (WebAuthn/FIDO2, unlocked with Face ID or the device passcode), which is phishing-resistant because it is bound to settledownfinancial.com; a code from an authenticator app (TOTP) is offered as a fallback. The backend enforces this: it refuses to create a Plaid Link token or exchange a public token for a session below AAL2.
- Sessions are short-lived JSON Web Tokens with refresh tokens. On the phone they are stored only in the iOS Keychain (Expo SecureStore), never in plain storage.
- Postgres row-level security is enabled on every table that holds household data, so a signed-in user can read and write only their own household's rows. New tables must enable row-level security in the same migration that creates them.
- Plaid items and access-token references are not readable from the app at all. The app sees only display fields (institution name and link status) through a restricted view.
- Every edge function called by the app verifies the user's session and household membership before it reads or writes data with the service role. Functions called by Plaid verify the Plaid webhook signature (ES256 JWT, body SHA-256 hash, 5-minute maximum age). Scheduled functions require a secret that is checked before any work is done.
- Household invitations use single-use codes that expire. Only the household owner can remove members.

## 5. Encryption and secrets management

Consumer data is encrypted in transit with TLS 1.2 or higher and at rest with AES-256, and Plaid access tokens get an extra layer of encryption in Supabase Vault.

**In transit.**

- All traffic between the app, the backend, Plaid, Anthropic, Expo and Apple uses HTTPS with TLS 1.2 or higher. Plain HTTP is never used for any API call.
- iOS App Transport Security stays on. No exceptions are added to the app configuration.
- The app talks only to the Supabase API. It never calls Plaid's API directly and never receives a Plaid access token or client secret.

**At rest.**

- The Supabase Postgres database, its backups and Supabase Storage are encrypted at rest with AES-256 by the hosting provider.
- Plaid access tokens are additionally encrypted in Supabase Vault (authenticated encryption, key held outside the database). The application tables store only the Vault secret id. The functions that store and read tokens are callable only by the service role, not by app users.
- On the phone, session tokens are kept in the iOS Keychain, and the device's data protection encrypts app storage.
- Receipt photos are sent to the backend for reading and are not stored after the scan.

**Secrets.**

- Backend secrets (Plaid client id and secret, Supabase service-role key, Anthropic API key, Expo access token, cron secret) live only in Supabase edge-function secrets. Build credentials live only in EAS secrets. Nothing secret is placed in `EXPO_PUBLIC_` variables or anywhere else that ships in the app bundle.
- Secrets are never committed to source control. The repository ignores `.env` files and key files, and GitHub secret scanning with push protection is turned on.
- Each environment (Plaid Sandbox and Plaid Production) has its own secrets. Production secrets are never used on a developer machine except to set them in Supabase.
- Secrets are rotated at least once a year, immediately when someone with access leaves, and immediately if exposure is suspected.

## 6. Secure development, change and vulnerability management

Every change to the app or backend goes through a reviewed pull request with passing tests, and known vulnerabilities are patched on a fixed schedule.

**Change management.**

- Source code is in a private GitHub repository. The `main` branch is protected: changes land only through pull requests, and force-pushes to `main` are blocked.
- Each pull request is reviewed before merge, including code written with AI coding assistants, which is reviewed by a person like any other change. The reviewer checks access control, row-level security and secret handling in addition to correctness.
- Typecheck and automated tests run in GitHub Actions on every pull request and must pass before merge.
- Database changes are made only through versioned migration files in the repository, never by hand in production. A new table must enable row-level security in the same migration.
- App releases go through EAS builds and TestFlight before the App Store. Backend deploys are made from the reviewed `main` branch.

**Secure coding rules.**

- Validate input at every edge function, check the caller's household before using the service-role client, and return generic error messages to the app.
- Never log access tokens, secrets, full account numbers, or full request bodies that contain consumer data.
- AI features follow the same rules as the rest of the app: the model never receives secrets or credentials, and any action it proposes that changes something for the user (such as cancelling a subscription) needs the user's explicit approval on the device.

**Vulnerability management.**

- Production assets are managed services (Supabase-hosted database and edge functions, Expo and Apple build infrastructure); their providers scan and patch the underlying servers. We scan what we deploy: GitHub Dependabot alerts and update pull requests, a weekly automated `npm audit` and secret scan in CI, and the Supabase Security Advisor before each release.
- Computers used to administer production run built-in vulnerability and malware protection (Microsoft Defender on Windows, XProtect on macOS) with automatic OS updates. Each month the Security Owner confirms on every such device that updates are current and the protection reports no threats, and logs it.
- Patch deadlines from the time a fix is available: critical within 7 days, high within 30 days, medium and low at the next planned release.
- The Security Owner keeps the Expo SDK, React Native and backend libraries on supported versions.

## 7. Vendors, logging and incident response

Consumer data goes only to the vendors listed below and only for the purpose shown, every production system keeps logs, and suspected incidents are handled under a written response plan.

**Approved vendors.**

| Vendor | Purpose | Consumer data it receives |
| --- | --- | --- |
| Plaid | Connect bank accounts and fetch transactions | Bank credentials entered by the user in Plaid Link (never seen by us); returns accounts and transactions |
| Supabase | Database, auth, Vault, storage, edge functions | All stored data (encrypted at rest) |
| Anthropic (Claude API) | AI features: answers to questions, insights, bucket sorting, receipt reading, subscription-cancel assistant | Merchant names, amounts, dates and budget categories needed for the feature; receipt images; page text from the cancel assistant with typed values, emails and long numbers removed. Never Plaid tokens, account numbers or passwords. Under Anthropic's commercial terms, API data is not used to train models |
| Expo | App builds and push delivery | Push token and notification text (merchant, amount, budget status) |
| Apple | App distribution and push notifications | Push token and notification text |
| GitHub | Source code hosting | No consumer data |

A new vendor may receive consumer data only after the Security Owner reviews its security (a SOC 2 Type II or ISO 27001 report where available), confirms it will not sell or train on the data, records it in this table, and updates the privacy policy. Vendor reports are reviewed again each year.

**Logging and monitoring.**

- Supabase keeps API, auth, database and edge-function logs. Plaid Dashboard, GitHub, Apple and Anthropic keep their own account and audit logs.
- Logs record events and errors, not secrets or full consumer records.
- The Security Owner reviews failed sign-ins, new admin accounts, Plaid item errors and unexpected spikes in API or AI usage at least weekly, and turns on available alerts (billing and usage alerts, GitHub security alerts, Supabase advisors).

**Incident response.**

1. **Detect and report.** Anyone who suspects an incident (a leaked secret, unexpected access, a lost device with access, or a vendor breach notice) tells the Security Owner immediately.
2. **Contain.** Revoke or rotate the affected credentials (Plaid secret, service-role key, API keys, user sessions), disable affected accounts or functions, and remove affected Plaid items with Plaid's item removal endpoint if tokens may be exposed.
3. **Assess.** Use logs to work out what data and which users were affected and how.
4. **Notify.** Notify Plaid without undue delay, and within any time limit in our agreement with Plaid, of any incident that involves Plaid data or credentials. Notify affected users and regulators as required by applicable law.
5. **Recover and learn.** Fix the root cause, restore from backup if needed, write a short post-incident report, and update this policy and the risk register.

The plan is walked through as a tabletop exercise at least once a year.

## 8. Retention, deletion, privacy and consent

We keep consumer data only while the user has an account, delete it on request, and never sell it.

**Consent and privacy.**

- A privacy policy at settledownfinancial.com/privacy explains what data we collect, why, which vendors receive it, how long we keep it and how to delete it. It links to Plaid's End User Privacy Policy.
- Before Plaid Link opens, the app shows a data-use notice: that Plaid is used, what data is collected, how it is used and shared, that it is never sold, and how to unlink or delete it, with links to our privacy policy and Plaid's. The user must tap "Agree and continue". The backend records the notice version and time of agreement and will not create a Plaid Link token without it. If the notice changes materially, users agree again before linking more accounts.
- The user starts every bank connection themselves; accounts are never linked on their behalf.
- We do not sell consumer data, share it for advertising, or use it for any purpose other than providing the app's features to that user and their household.
- Each household member links and controls their own bank logins. Only the person who linked a bank can unlink it.

**Retention and deletion.**

| Data | Kept | Deleted |
| --- | --- | --- |
| Linked bank (Plaid item, access token, its accounts and transactions) | While linked | When the user unlinks it: the item is removed with Plaid's `/item/remove`, the Vault secret is deleted, and its accounts and transactions are deleted at once |
| All of a user's data | While the account is active | Within 30 days after the user deletes their account in the app or by email request; all their Plaid items are removed with Plaid |
| Inactive accounts | Up to 24 months without sign-in | After a notice to the user (push notification) 30 days before deletion |
| Receipt images | Only while being read | Not stored after the scan |
| Subscription-cancel conversations | 30 days | The page text is cleared after 30 days; the outcome (service, date, confirmation) stays as the user's record |
| Logs | Provider default | Rolled off on the provider's schedule |
| Backups | Provider default (no more than 30 days) | Rolled off on the provider's schedule; deleted data leaves backups when they expire |

Data is kept longer only when the law requires it.

## 9. Devices, training and exceptions

People with access use secured devices, know this policy, and may depart from it only through a written, time-limited exception.

**Endpoint security.** Computers and phones used to administer production systems must have full-disk encryption (BitLocker or FileVault; iOS data protection), automatic OS and browser updates, built-in malware protection turned on (for example Microsoft Defender), a screen lock of 5 minutes or less, and a passcode or biometric unlock. Consumer data is not downloaded to these devices. A lost or stolen device is reported at once, and its sessions and keys are revoked.

**Training and screening.** Everyone with production access reads and accepts this policy before access is granted and again after each annual review, and completes security awareness training each year covering phishing, password and MFA use, secret handling and incident reporting. Employees and contractors hired in the future who will have production access are background-checked where the law allows.

**Exceptions.** Any exception to this policy is written down with its reason, compensating controls and an end date, and approved by the Security Owner. Exceptions are reviewed at each quarterly access review.

**Enforcement.** Breaking this policy can lead to loss of access and, for employees and contractors, termination of the relationship.

## Revision history

| Version | Date | Change | Approved by |
| --- | --- | --- | --- |
| 1.0 | 2026-11-10 | First version | David Elias, Security Owner |
| 1.2 | 2026-11-10 | Passkeys (phishing-resistant MFA) added as the default second factor before Plaid Link | David Elias, Security Owner |
| 1.1 | 2026-11-10 | Second factor required for every user before Plaid Link and enforced by the backend; consent recorded; vulnerability scanning detail; operations log | David Elias, Security Owner |
