# Family Budget

iPhone-first budget tracker for the family, built to grow into a commercial app.

- **App:** Expo (React Native + TypeScript), Expo Router. Builds for iOS in the cloud with EAS, so no Mac is needed.
- **Backend:** Supabase (Postgres with row-level security per household, auth, Vault for Plaid tokens, Deno edge functions).
- **Bank data:** Plaid Transactions (`/transactions/sync` driven by webhooks).
- **Push:** Expo push service → APNs.
- **Receipts:** Claude reads receipt photos and suggests a bucket per line item.

## Layout

| Path | What |
|---|---|
| `app/` | Screens (Budget, Activity, Savings, Settings, New Bucket, Scan Receipt) |
| `src/domain/` | Pure budget logic shared by app and backend: categorizing, bucket status, notification text, receipt splits, overspend → savings impact. Tested in `domain.test.ts`. |
| `src/data/` | App state. Uses sample data until the backend is connected. |
| `supabase/migrations/` | Database schema, RLS policies, Vault helpers, `create_household()` seeding default buckets |
| `supabase/functions/` | `plaid-link-token`, `plaid-exchange`, `plaid-webhook` (sync + categorize + push), `receipt-scan` |

`supabase/functions/_shared/domain` is a copy of `src/domain`; run `npm run sync-domain` after changing the logic.

## Run it

```bash
npm install
npm test            # budget logic tests
npm run typecheck
npx expo start      # scan the QR code with Expo Go on your iPhone
```

## Backend secrets (Supabase → Edge Functions → Secrets)

`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` | `production`), `ANTHROPIC_API_KEY`, optional `EXPO_ACCESS_TOKEN`, `PLAID_REDIRECT_URI`.

## Not built yet

- Sign-in and connecting the app screens to Supabase (currently sample data)
- Plaid Link screen in the app (needs a development build, not Expo Go)
- Registering the phone's push token
- Receipt camera screen and the confirm-split UI
- Editing buckets, goals and merchant rules
