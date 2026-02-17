# pdx.run

SvelteKit site for PDX Dino Run, deployed on Cloudflare Pages with D1-backed form submissions.

## Requirements

- Node.js (see `package.json#engines`)
- pnpm (see `package.json#packageManager`)

## Setup

```bash
pnpm install
pnpm db:migrate:local
```

## Scripts

- `pnpm dev` - run Vite dev server
- `pnpm build` - production build
- `pnpm preview` - preview production build
- `pnpm cf:dev` - Cloudflare Pages local runtime (`http://127.0.0.1:3580`)
- `pnpm cf:deploy` - build + deploy to Cloudflare Pages
- `pnpm cf:check` - predeploy checks (auth, D1 IDs, validate, build output)
- `pnpm db:migrate:local` - apply D1 migrations to local DB
- `pnpm db:migrate:remote` - apply D1 migrations to remote DB
- `pnpm lint` - ESLint (strict)
- `pnpm check` - `svelte-check` + TypeScript
- `pnpm test:unit` - Vitest unit tests (`__tests__/unit`)
- `pnpm test:e2e` - Playwright e2e tests (`__tests__/e2e`)
- `pnpm test:all` - unit + e2e
- `pnpm validate` - lint + check + build

## Runtime config

- Cloudflare adapter: `@sveltejs/adapter-cloudflare`
- Wrangler config: `wrangler.toml` (`nodejs_compat` enabled, D1 binding `DB`)
- Turnstile env vars:
- `PUBLIC_TURNSTILE_SITE_KEY` - client widget site key
- `TURNSTILE_SECRET_KEY` - server verification secret
- `TURNSTILE_BYPASS` - optional test/dev bypass (`true` only outside production)

## Internal routes

- `/` - homepage
- `/join` - attendee signup form (writes to D1)
- `/volunteer` - volunteer signup form (writes to D1)
- `/donate` - donation options
- `/routes` - route details + downloads
- `/code-of-conduct` - event conduct policy
- `/thanks` - post-submit confirmation
- `/api/remind` (POST) - reminder email capture (writes to D1)

## Cloudflare Pages build settings

- Framework preset: `None`
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Build output directory: `.svelte-kit/cloudflare`
- Root directory: `/` (repo root)

## Production deploy checklist

1. `pnpm cf:check`
2. `pnpm db:migrate:remote`
3. `pnpm cf:deploy`

## Recommended branch protection

Protect `main` and require these GitHub checks before merge:

- `Lint, Typecheck, Build, Unit`
- `E2E (Playwright)`

Also recommended:

- Require pull request before merging
- Require branches to be up to date before merging
- Include administrators

## Project layout

- `src/routes/` - page and server routes
- `src/lib/content/site.ts` - canonical homepage content
- `src/lib/components/` - section components
- `src/lib/styles/` - design tokens + BEM SCSS
- `src/lib/server/submissions.ts` - form validation + D1 persistence
- `migrations/` - D1 schema migrations
- `static/` - static assets, route files, OG image
- `__tests__/unit/` - fast logic and server tests
- `__tests__/e2e/` - browser interaction tests

## Test setup

```bash
pnpm exec playwright install
pnpm test:all
```
