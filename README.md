# pdx.run

SvelteKit site for PDX Dino Run, deployed on Cloudflare Pages with D1-backed form submissions.

## Requirements

- Node.js 22+
- pnpm 10+

## Setup

```bash
pnpm install
pnpm db:migrate:local
```

## Scripts

- `pnpm dev` - run Vite dev server
- `pnpm build` - production build
- `pnpm preview` - preview production build
- `pnpm cf:dev` - Cloudflare Pages local runtime (`http://127.0.0.1:8788`)
- `pnpm cf:deploy` - build + deploy to Cloudflare Pages
- `pnpm db:migrate:local` - apply D1 migrations to local DB
- `pnpm db:migrate:remote` - apply D1 migrations to remote DB
- `pnpm lint` - ESLint (strict)
- `pnpm check` - `svelte-check` + TypeScript
- `pnpm validate` - lint + check + build

## Runtime config

- Cloudflare adapter: `@sveltejs/adapter-cloudflare`
- Wrangler config: `wrangler.toml` (`nodejs_compat` enabled, D1 binding `DB`)

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

## Project layout

- `src/routes/` - page and server routes
- `src/lib/content/site.ts` - canonical homepage content
- `src/lib/components/` - section components
- `src/lib/styles/` - design tokens + BEM SCSS
- `src/lib/server/submissions.ts` - form validation + D1 persistence
- `migrations/` - D1 schema migrations
- `static/` - static assets, route files, OG image
