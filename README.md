# setu-retail-fe

Web app for **Setu Retail**, the premium cloud POS from [Setu Technology](https://setutechnology.com).
API: [`setu-retail-be`](https://github.com/sagar305/setu-retail-be). Build plan: [`docs/PLAN.md`](docs/PLAN.md).

**Stack:** Vite 8 · React 19 · TypeScript · Tailwind CSS 4 (Setu brand tokens) · React Router 7 · installable PWA that opens offline · Vitest + Testing Library.

## Run locally

```bash
cp .env.example .env.local    # VITE_API_URL=http://localhost:4000
npm install                   # npm 10 works from the lockfile; use npm 11+ if you change dependencies
npm run dev                   # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest (jsdom) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc -b` |
| `npm run build` | Production build + service worker (`dist/`) |
| `npm run preview` | Serve the build — use this to test offline |

## What's built

- **Phase 0:** app shell from the approved prototype — indigo sidebar (hide/show, remembered per device; a drawer on phones), top bar, online/offline chip, brand tokens, bundled Sora font, offline-capable PWA.
- **Phase 1:** sign up → verify email (starts the 3-month Basic trial) → sign in with email or username; forgot/reset password; staff invite links. Branches (codes B1, B2…), staff (owner adds managers/cashiers, managers add cashiers), plan & license key (check → switch now / start later → redeem), and the keep-active picker after a downgrade. Navigation and screens follow the signed-in user's role; an owner whose plan ended only reaches the plan screen.

- **Phase 2a:** billing counter (search/scan, loose quantities, customer, discount with the cashier cap, GST totals computed by the same engine as the API, Cash/UPI/Card/Udhaar, change, hold/recall), GST receipt for 80 mm / 58 mm / A4 with HSN, CGST/SGST or IGST, place of supply and amount in words; products with branch price and stock; customers; orders with reprint, cancel and partial returns (GST credit notes); billing & receipt settings and payment methods. Each device registers once per branch as a counter and keeps its own bill series.

- **Phase 2b:** dashboard (today, yesterday, 7-day chart, payments, branches, top products, low stock, below-zero and expiry alerts); reports with date presets in shop time and CSV downloads — sales, GST (by rate net of credit notes, HSN summary, B2B, B2C, credit notes), stock & expiry, staff & margin, stock log; batch & expiry tracking (receive batches, earliest-expiry-first with cashier override at billing, batch/expiry on receipts); import from CSV (our template or the free POS exports) and from the free POS backup; product and customer CSV export.

## Talking to the API

- `src/lib/api.ts` keeps the access token in memory; the 12-hour refresh token is an http-only cookie the browser sends to `/auth/*`. A 401 triggers one shared refresh and a single retry.
- Types are generated from the API spec: `npm run api:types` (reads `../setu-retail-be/openapi.json`; run `npm run openapi:export` there first after API changes).

## Deploy (Vercel)

- Framework preset **Vite**. `vercel.json` adds the SPA fallback, never-cache for `sw.js`, long cache for hashed assets and basic security headers.
- Env var: `VITE_API_URL=/api`. `vercel.json` passes `/api/*` on to the API (`https://setu-retail-be.vercel.app`), so the browser sees one site and the sign-in cookie is first-party. The API needs `COOKIE_PATH_PREFIX=/api`. After the custom domains you can keep this, or switch to `VITE_API_URL=https://api.retail-pos.setutechnology.com` and clear `COOKIE_PATH_PREFIX`.
- The production build stops if `VITE_API_URL` is missing or malformed, rather than silently calling `localhost`. Locally, `VITE_API_URL=/api npm run dev` uses the same pass-through to `localhost:4000`.
- Domain: `app.retail-pos.setutechnology.com`.

## Demo build

The public demo is a **second Vercel project on this repo** (`demo.retail-pos.setutechnology.com`), pointed at the demo API (a second Vercel project on setu-retail-be with its own database, see its README → Demo deployment).

- Domains: app `demo.retail-pos.setutechnology.com`, API `demo-api.retail-pos.setutechnology.com`. Both under setutechnology.com, so the sign-in cookie (SameSite=Lax) works without the `/api` rewrite; `vercel.json`'s rewrite keeps pointing at production and the demo build simply doesn't use it.
- Env vars: `VITE_API_URL=https://demo-api.retail-pos.setutechnology.com`, `VITE_DEMO_MODE=true`, `VITE_DEMO_LOGIN=<login>|<password>` of the demo shop, optionally `VITE_PRODUCTION_APP_URL` (default `https://app.retail-pos.setutechnology.com`).
- What changes in a demo build (`src/lib/demo.ts`): the sign-in screen shows the demo login with a "Use demo login" button; "Create account" and `/sign-up` go to the real app; a strip under the header counts down to the next reset (`GET /demo/reset`); signing in clears this device's saved copy and unsent changes, since a reset has wiped them from the cloud. Nothing of this runs in the real app: production never calls `/demo/reset`.
