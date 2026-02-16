# pdx.run

Single-page SvelteKit site for PDX Dino Run.

## Requirements

- Node.js 22+
- pnpm 10+

## Setup

```bash
pnpm install
```

## Scripts

- `pnpm dev` - run Vite dev server
- `pnpm build` - production build
- `pnpm preview` - preview production build
- `pnpm cf:dev` - Cloudflare Pages local runtime (`http://127.0.0.1:8788`)
- `pnpm cf:deploy` - build + deploy to Cloudflare Pages
- `pnpm lint` - ESLint (strict)
- `pnpm check` - `svelte-check` + TypeScript
- `pnpm validate` - lint + check + build

## Runtime config

- Server host: `0.0.0.0`
- Default port: `3580` (override with `PORT`)
- Strict port: enabled
- VM reserved range: `3580-3589` (`vm.yaml`)
- Cloudflare adapter: `@sveltejs/adapter-cloudflare`
- Wrangler config: `wrangler.toml` (`nodejs_compat` enabled)

## Project layout

- `src/routes/+page.svelte` - page composition
- `src/lib/content/site.ts` - canonical page copy/data
- `src/lib/components/` - section components
- `src/lib/styles/` - design tokens + BEM SCSS
- `static/` - static assets, route placeholders, OG image
