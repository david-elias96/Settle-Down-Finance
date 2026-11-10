# Settle Down Finance Data Retention and Disposal Policy

Version 1.0 · Effective 2026-11-10 · Owner: Security Owner (founder)

## 1. Purpose and scope

Settle Down Finance keeps consumer data only as long as the user has an account and needs it for the app. We delete it when the user unlinks a bank, deletes their account or stops using the app, and we dispose of it so it cannot be recovered.

This policy expands section 8 of the Settle Down Finance Information Security Policy. It covers:

- All consumer data we receive from Plaid: accounts, balances and transactions.
- Other consumer data in the app: profile, household and budget data, savings goals, AI credits, notifications, receipts and subscription-cancel assistant sessions.
- Plaid access tokens and other secrets that give access to consumer data.
- Every place this data can exist: the production database, Supabase Vault and Storage, provider backups and logs, vendors that process it, and the user's own phone.

## 2. Principles

1. **Keep only what the feature needs.** We request only Plaid Transactions, 90 days of history at first link, and US institutions.
2. **Keep it only as long as needed.** Every kind of data has a retention period, listed in section 3.
3. **The user controls deletion.** Users can unlink a bank or delete their account in the app at any time, without contacting us.
4. **Deletion is enforced in code.** Deletion and retention run through tested backend functions and a daily scheduled job, not manual steps.
5. **Disposal is complete.** Deleting data also ends our access at Plaid and destroys the related secrets.

## 3. Retention schedule

| Data | Where it lives | Kept | Disposal |
| --- | --- | --- | --- |
| Linked bank: Plaid item, its accounts and transactions | Supabase Postgres | While the bank is linked | On unlink: Plaid `/item/remove` ends our access, and the bank's accounts and transactions are deleted at once |
| Plaid access token | Supabase Vault (encrypted) | While the bank is linked | Vault secret deleted at unlink or account deletion |
| All of a user's data (profile, household membership, budgets, goals, credits, consents, push tokens, linked banks) | Supabase Postgres and Vault | While the account is active | Within 30 days of an in-app deletion or emailed request. In-app deletion runs at once |
| Inactive accounts | Supabase | Up to 24 months without sign-in | The user is notified 30 days before the 24-month mark, then the account is deleted as above |
| Receipt images | Sent to the backend for reading | Only while being read | Not stored after the scan |
| Subscription-cancel assistant page text | Supabase Postgres | 30 days | Cleared by the daily retention job; the outcome (service, date, confirmation) stays as the user's record until the account is deleted |
| Consent records (notice version and time) | Supabase Postgres | While the account is active | Deleted with the account |
| Application and auth logs | Supabase and other providers | Provider default | Rolled off on the provider's schedule. Logs never contain tokens, secrets, account numbers or full request bodies |
| Backups | Supabase | Provider default, no more than 30 days | Expire on the provider's schedule; deleted data is gone from backups once they expire |
| Data on the user's phone (session in Keychain, cached screens) | User's iPhone | While the app is signed in | Cleared at sign-out, account deletion or app removal |

Data is kept longer only when the law requires it (section 6).

## 4. How data is disposed of

**Unlinking a bank.** The user unlinks a bank in Settings. The backend `plaid-unlink` function calls Plaid `/item/remove`, so Plaid stops sharing data with us and the access token stops working. It then deletes the Vault secret and the item. That bank's accounts and transactions are deleted with it by database cascade. Only the person who linked a bank can unlink it.

**Deleting an account.** The user deletes their account in Settings. The backend `delete-account` function removes every Plaid item the user linked, using the same steps as unlinking. It then deletes the user's data and their sign-in account. If other members remain in the household, the shared budget, buckets and goals stay with them, but the leaving user's banks and transactions are removed. If the user is the last member, the household and all of its data are deleted, including any banks still linked to it. A deletion request sent by email to admin@settledownfinancial.com is handled the same way within 30 days. It must come from the account's email address, or the requester must sign in to confirm identity. We confirm by email when it is done.

**Scheduled retention.** A `retention` function runs daily. It authenticates with a dedicated secret and fails closed if the secret is missing. Each run it:

- clears cancel-assistant page text older than 30 days;
- notifies users approaching 24 months without sign-in;
- deletes accounts that reach 24 months without sign-in after the 30-day notice.

Each run reports how many records it cleared, warned and deleted. These counts are reviewed with the weekly log review.

**One code path.** Unlinking, account deletion and inactive-account deletion all use the same tested functions (`removePlaidItem` and `deleteUserData`). Every new table that holds user data must be deleted by that path, through a database cascade from the user, household or Plaid item. Code review checks this.

**Physical media.** We have no servers, paper records or removable media holding consumer data. Our hosting providers dispose of storage media under their own audited procedures. Consumer data is never downloaded to company computers. A computer or phone used to administer production is wiped with a full factory reset before it is sold, recycled or reassigned. Its disk is already fully encrypted.

## 5. Vendors

When we delete data, the following happens at each vendor:

- **Plaid:** `/item/remove` ends our access to the item. Plaid then handles its own copy under its End User Privacy Policy, which our privacy policy links to.
- **Supabase:** deleted rows and Vault secrets are removed from the live database at once, and from backups when they expire.
- **Anthropic (Claude API):** receives only the fields a feature needs, never tokens, account numbers or passwords. It keeps API data under its commercial retention terms and does not use it to train models.
- **Expo and Apple:** receive only push tokens and notification text. Push tokens are deleted with the account.

A new vendor that would receive consumer data must first be reviewed, including how long it keeps that data, and added to the Information Security Policy.

## 6. Legal requirements and requests

- We honor requests to know, access, correct and delete personal information under applicable US state privacy laws, such as the California Consumer Privacy Act. Requests go to admin@settledownfinancial.com and are answered within the time the law allows, at most 45 days. Deletion requests are completed within 30 days.
- If the law, a court order or an active investigation requires us to keep specific data, the Security Owner records the hold and its reason. Only that data is kept, and only until the hold ends; it is then deleted under this policy.
- We do not sell consumer data or share it for advertising.

## 7. Roles

| Role | Responsibility |
| --- | --- |
| Security Owner (founder) | Owns this policy; handles emailed requests; records legal holds; reviews retention job results weekly; reviews this policy yearly |
| Developers | Make sure new data has a retention period and is deleted by the standard deletion path; update this policy and the retention job in the same change |
| Users | Can unlink banks and delete their account in the app at any time |

## 8. Review

This policy is reviewed at least every 12 months with the Information Security Policy. It is also reviewed when we add a new kind of consumer data, a new Plaid product or a new vendor, or when privacy law changes. Changes are made through a reviewed pull request and recorded below.

## Revision history

| Version | Date | Change | Approved by |
| --- | --- | --- | --- |
| 1.0 | 2026-11-10 | First version | David Elias, Security Owner |
