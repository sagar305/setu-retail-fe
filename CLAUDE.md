# CLAUDE.md — setu-retail-fe

Web app for Setu Retail (premium cloud POS). The agreed plan is `docs/PLAN.md` and the approved UI prototype is
https://claude.ai/artifact/BasiGikDDkKYPKRbNoUUoo — follow both, and ask before changing a decision recorded there.

## Commands
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm run preview` (offline testing)

## Conventions
- Tailwind only, using the brand tokens in `src/index.css`; no CSS modules. Sora is bundled via `@fontsource-variable/sora`.
- Mobile-first: everything must work at 375px with no horizontal scroll; touch targets ≥ 44px.
- Navigation and role visibility live in `src/lib/nav.ts`. The UI hides what a role can't use, but the API is the real gate.
- Talk to the API through `src/lib/api.ts`; regenerate `src/lib/api-types.ts` with `npm run api:types` after API changes. Only `VITE_*` env vars reach the browser — never put secrets in them.
- The signed-in user comes from `useMe()` (`src/auth/AuthProvider.tsx`); role gates are `<Allow roles>` in `src/App.tsx`. Never keep the access token in storage.
- localStorage only for per-device preferences (via `src/lib/storage.ts`). Business data goes to the API, and offline data to IndexedDB (Phase 3).
- Money is integer minor units (paise/cents) end to end; format only for display.
- Accessible markup: real buttons/links/labels, `aria-label` on icon-only buttons.
- Pin exact dependency versions. Use npm 11+ to change dependencies (npm 10 crashes resolving vite/vitest optional peers); `npm ci` with npm 10 is fine.

## Git
- Branches `claude/<topic>`; PR into `main`. CI (lint, typecheck, test, build) must pass.
