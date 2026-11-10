@AGENTS.md

# Security rules (follow on every change)

This app handles consumer bank data from Plaid. Every change must follow [docs/security/information-security-policy.md](docs/security/information-security-policy.md), which we submitted to Plaid. The rules below are the parts that apply to code. If a task would break one, stop and say so instead of working around it.

## Secrets
- Never commit secrets, `.env` files, keys or tokens. Backend secrets live only in Supabase edge-function secrets; build credentials only in EAS secrets.
- Nothing secret goes in `EXPO_PUBLIC_*`, `app.json`, or anything else that ships in the app bundle. The app only ever holds the Supabase URL and anon key.
- Plaid access tokens live only in Supabase Vault. Tables store the Vault secret id. Read them only with `read_plaid_token` from edge functions; never return them to the app, log them, or send them to Claude.

## Database
- Every new table that holds household or user data enables row-level security, with policies, in the same migration that creates it. Scope policies with `is_member(household_id)` or `auth.uid()`.
- Schema changes only through new files in `supabase/migrations/`. Never edit an applied migration.
- `security definer` functions set `search_path` and have `execute` revoked from `public`/`anon` (and from `authenticated` unless the app must call them).
- Nothing the app can read may expose `plaid_items.access_token_secret_id` or other secret references.

## Edge functions
- Functions the app calls must call `requireMember(req, householdId)` before using the `admin` (service-role) client.
- `plaid-webhook` must keep verifying the `Plaid-Verification` JWT and body hash. Scheduled functions must check their secret and fail closed if it is unset.
- Validate input, return generic errors to the app, and never log tokens, secrets, account numbers or full request bodies with consumer data.

## Data handling
- Request only the Plaid products and history the feature needs (today: Transactions, 90 days, US). Adding a product or vendor means updating the policy first.
- Send Claude only the fields a feature needs (merchant, amount, date, bucket). Never Plaid tokens, account numbers, passwords or other secrets. The cancel agent keeps stripping typed values, emails and long numbers, and the user approves the final click.
- Unlinking a bank or deleting an account must call Plaid `/item/remove` and delete the Vault secret.
- Never put real transaction data, statements or personal names in the repo, tests, fixtures or screenshots. Use the sample data in `src/data/demo.ts` or Plaid Sandbox.

## App
- Store auth sessions with `expo-secure-store` (Keychain), never AsyncStorage.
- Keep App Transport Security on; HTTPS only.
- Plaid Link opens only for a signed-in user with a second factor (Sign in with Apple, or email plus authenticator MFA), after the consent screen.

## Process
- All changes go through a pull request with typecheck and tests passing (`npm run typecheck`, `npm test`, `deno test` for functions).
- When a change touches auth, RLS, secrets, Plaid, or what is sent to Claude, say in the PR description how it follows these rules.
- If code doesn't yet meet the policy, add a row to [docs/security/gaps.md](docs/security/gaps.md); remove the row in the PR that closes it.
