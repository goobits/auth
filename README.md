# 🎨 miko-art

Personal website and social calendar system built with SvelteKit 5, deployed to Cloudflare Pages.

## ✨ Key Features

- **📅 Social Calendar** - Event feed, join/waitlist flows, +1 support, and Google Calendar integration
- **🔐 Authentication** - OAuth (Google, Apple) + credentials-based registration via `@goobits/auth`
- **🛡️ Admin Dashboard** - Session-based admin access for managing events, programs, and settings
- **🌐 Cloudflare D1** - Serverless SQLite with automatic migrations in development
- **🎭 Theme System** - Default, dark, and magic theme modes
- **📝 Journal** - Markdown-powered blog with mdsvex

## 🚀 Quick Start

```bash
# Requirements: Node.js 22+, pnpm 10+
pnpm install

# Start dev server (port 3610)
pnpm dev

# Or with full Cloudflare D1 runtime
pnpm dev:wrangler
```

```bash
# Production build (auto version bump)
pnpm build:patch

# Preview production build (port 3000)
pnpm preview
```

## 📦 Internal Packages

### @miko/calendar

Google Calendar integration, event/participant storage, program routing, and invite management.
Event participation is written first; Google sync runs asynchronously via a retry queue.

### @goobits/auth

Auth library used by this repo for OAuth + sessions (shared by `/calendar`, `/admin`, and `/register`).

```bash
# Auth package has its own test suite
cd repos/auth
pnpm test           # Unit tests (vitest)
pnpm test:watch     # Watch mode
pnpm test:ui        # Vitest UI
pnpm check:types    # TypeScript validation
```

## ⚙️ Configuration

### Path Aliases

Defined in `svelte.config.js`:

| Alias | Path |
|---|---|
| `@components` | `./src/components` |
| `@config` | `./src/config` |
| `@lib` | `./src/lib` |
| `@media` | `./src/media` |
| `@src` | `./src` |
| `@routes` | `./src/routes` |
| `@packages` | `./packages` |
| `@static` | `./static` |

### Database

- **Production:** Cloudflare D1 (`miko-art-db`)
- **Development:** Local SQLite (`.dev/db.sqlite`, auto-migrates)
- **Migrations:** `packages/calendar/migrations/`

## 🛠️ Scripts

```bash
pnpm dev              # Vite dev server (port 3610)
pnpm dev:wrangler     # Dev with Cloudflare D1 runtime
pnpm build            # Production build
pnpm build:patch      # Patch bump + build
pnpm preview          # Preview build (port 3000)
pnpm dev:stop         # Stop dev server
pnpm dev:restart      # Restart dev server
pnpm check            # Types + svelte-check + lint + circular deps
pnpm ci:gate          # check + critical e2e gate (CI default)
pnpm test             # Full Vitest + Playwright e2e suite (__tests__/e2e)
pnpm e2e:critical     # Fast high-signal e2e subset (no visual/sitemap drift-heavy checks)
pnpm calendar:sync    # Process pending calendar Google-sync jobs (ops/cron/calendar-sync.mjs)
pnpm deploy:secrets   # Push production secrets only (no site deploy)
pnpm deploy:prod      # Build + Cloudflare Pages deploy (standard)
pnpm deploy:prod:full # Secrets + build + Cloudflare Pages deploy

# Versioning
pnpm version:patch    # Bump patch version
pnpm version:minor    # Bump minor version
pnpm version:major    # Bump major version
```

## 🔐 Environment

All env files live in `config/env/` and are encrypted at rest with [dotenvx](https://dotenvx.com/encryption).

| File | Purpose |
|---|---|
| `config/env/.env.example` | Template with all variables and setup hints |
| `config/env/.env` | Local dev values (encrypted) |
| `config/env/.env.keys` | Private decryption key (never commit) |
| `config/env/.env.production` | Production values pushed to Cloudflare secrets |

```bash
# Decrypt for editing
pnpm exec dotenvx decrypt -f config/env/.env

# Re-encrypt after editing
pnpm exec dotenvx encrypt -f config/env/.env

# Push production secrets to Cloudflare
pnpm deploy:secrets
```

For async calendar sync processing in production, run `pnpm calendar:sync` on a schedule
(cron/worker) using `CALENDAR_SYNC_CRON_SECRET` and `PUBLIC_BASE_URL`.

Ops runbooks/scripts live under `ops/`:
- `ops/cron/calendar-sync.mjs`
- `ops/runbooks/calendar-sync.md`

`pnpm deploy:secrets` only updates runtime secrets and does not deploy site code.

## 🚢 Deployment

Deployed to Cloudflare Pages via `wrangler pages deploy`.

Requires:
- D1 database (`miko-art-db`) provisioned
- Production secrets encrypted in `config/env/.env.production` and pushed via `pnpm deploy:secrets`

### One-command deploy

```bash
# Standard deploy (most common)
pnpm deploy:prod

# Full deploy (when secrets changed)
pnpm deploy:prod:full
```

`deploy:prod` uses Pages project `miko-art` by default. Override with `CF_PAGES_PROJECT=<project-name>`.

## 📝 License

MIT
