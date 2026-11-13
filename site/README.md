# settledownfinancial.com

Static marketing site, hosted on Cloudflare Pages (project `settledownfinance`).

- `index.html` – landing page and signup funnel (all CSS and JS inline, no build step). `data-signup="open"` on `<html>` shows the free-trial buttons (to app.settledownfinancial.com/start); `"waitlist"` shows the waitlist form instead. See [docs/billing.md](../docs/billing.md)
- `privacy/index.html` – privacy policy (linked from the app and Plaid)
- `assets/` – app screenshots (sample data only, never real household data) and the self-hosted Fraunces font
- `functions/api/waitlist.js` – Pages Function behind the waitlist form

## Deploy

Run from this `site` folder so Wrangler picks up `functions/`:

```
cd site
npx wrangler pages deploy . --project-name settledownfinance
```

(Drag-and-drop uploads in the dashboard don't run Functions; the page still works,
but the waitlist form will ask people to email admin@settledownfinancial.com instead.)

## Waitlist setup (one time)

1. Cloudflare dashboard → Storage & Databases → KV → create a namespace, e.g. `waitlist`.
2. Workers & Pages → `settledownfinance` → Settings → Bindings → add a KV binding named `WAITLIST` pointing at it.
3. Redeploy. Sign-ups appear in the namespace as `email:<address>` keys.
