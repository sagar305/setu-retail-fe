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

## What Phase 0 contains

- App shell from the approved prototype: indigo sidebar (hide/show, remembered per device; a drawer on phones), top bar, sync chip.
- Navigation per role (owner / manager / cashier). Until sign-in arrives in Phase 1, a **Preview as** switcher sets the role.
- Brand tokens in `src/index.css` (`bg-indigo`, `bg-saffron`, `text-ink`, `bg-paper`, `text-muted`, `border-line`…), Sora font bundled (works offline).
- Service worker precaches the whole app; API responses are never cached by it (offline data goes to IndexedDB in Phase 3).

## Deploy (Vercel)

- Framework preset **Vite**. `vercel.json` adds the SPA fallback, never-cache for `sw.js`, long cache for hashed assets and basic security headers.
- Env var: `VITE_API_URL=https://api.retail-pos.setutechnology.com`.
- Domain: `app.retail-pos.setutechnology.com`.
