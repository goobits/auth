# miko-art

Personal website and booking system built with SvelteKit, deployed to Cloudflare Pages.

## Requirements

- Node.js 22+
- pnpm 10+

## Setup

```bash
pnpm install
```

## Development

**Vite dev server** (fast refresh, no Cloudflare runtime):
```bash
pnpm dev
```

**Cloudflare Workers local** (full runtime with D1):
```bash
pnpm dev:wrangler
```

## Build

```bash
pnpm build
```

## Deployment

Deployed to Cloudflare Pages via `wrangler pages deploy`.

Requires:
- D1 database (`miko-art-db`)
- Secrets configured via `wrangler secret put`

## Tech Stack

- SvelteKit 2
- Cloudflare Pages + D1
- TypeScript
- @goobits/auth, @goobits/themes
