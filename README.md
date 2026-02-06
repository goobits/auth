# 🎨 miko-art

Personal website and booking system built with SvelteKit 5, deployed to Cloudflare Pages.

## ✨ Key Features

- **📅 Booking Calendar** - Appointment scheduling with Google Calendar integration and capacity control
- **🔐 Authentication** - OAuth (Google, Apple), passkeys, MFA, and local credentials via `@goobits/auth`
- **🛡️ Admin Dashboard** - Session-based admin access for managing bookings and settings
- **🌐 Cloudflare D1** - Serverless SQLite with automatic migrations in development
- **🎭 Theme System** - Dark mode support with cookie-based persistence
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
pnpm build

# Preview production build (port 3000)
pnpm preview
```

## 📦 Internal Packages

### @miko/calendar

Google Calendar integration, booking slots, availability management, D1 storage helpers, and email invites.

### @goobits/auth

Pluggable authentication for SvelteKit — OAuth 2.0 (PKCE), Argon2id password hashing, rolling sessions, token encryption (AES-256-GCM), rate limiting, magic links, and passkeys.

```bash
# Auth package has its own test suite
cd repos/auth
pnpm test           # Unit tests (vitest)
pnpm test:watch     # Watch mode
pnpm test:ui        # Vitest UI
pnpm typecheck      # TypeScript validation
```

## ⚙️ Configuration

### Path Aliases

Defined in `svelte.config.js`:

| Alias | Path |
|---|---|
| `@components` | `./src/components` |
| `@lib` | `./src/lib` |
| `@src` | `./src` |
| `@routes` | `./src/routes` |
| `@packages` | `./packages` |
| `@config` | `./src/config` |
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
pnpm preview          # Preview build (port 3000)
pnpm stop             # Stop dev server
pnpm restart          # Restart dev server

# Versioning
pnpm version:patch    # Bump patch version
pnpm version:minor    # Bump minor version
pnpm version:major    # Bump major version
```

## 🚢 Deployment

Deployed to Cloudflare Pages via `wrangler pages deploy`.

Requires:
- D1 database (`miko-art-db`) provisioned
- Secrets configured via `wrangler secret put`

## 📝 License

MIT
