# 🎨 miko-art
Personal website + invite-only social calendar built with **SvelteKit 5** and deployed to **Cloudflare Pages (D1)**.

## ✨ Key Features
- **📅 Social calendar** - Event feed, join/waitlist, +1, and “memories” recap cards
- **🛡️ Admin dashboard** - Manage programs, events, rules, members, and integrations
- **🔄 Google Calendar sync** - Asynchronous sync queue with retries and dead-letter handling
- **🔐 Auth** - OAuth (Google/Apple) for calendar access + credentials-based registration
- **🌗 Themes** - `default`, `dark`, and `magic`

## 🚀 Quick Start
```bash
# Requirements
node --version    # Node.js 22+
pnpm --version    # pnpm 10+

pnpm install

# Dev server (http://localhost:3610)
pnpm dev

# Dev server with the local Cloudflare runtime (D1 bindings)
pnpm dev:wrangler
```

## ⚙️ Configuration
```bash
# View the available env vars
ls -la config/env/.env.example

# Edit local dev secrets (encrypted at rest via dotenvx)
pnpm exec dotenvx decrypt -f config/env/.env
# edit config/env/.env
pnpm exec dotenvx encrypt -f config/env/.env
```

### Path Aliases
Defined in `svelte.config.js`:

| Alias | Path |
|---|---|
| `@components` | `./src/components` |
| `@config` | `./src/config` |
| `@lib` | `./src/lib` |
| `@media` | `./src/media` |
| `@packages` | `./packages` |
| `@routes` | `./src/routes` |
| `@src` | `./src` |
| `@static` | `./static` |

## 🧪 Testing & Code Quality
```bash
# Types + svelte-check + eslint + circular deps
pnpm check

# Full e2e suite (Vitest + Playwright)
pnpm test

# High-signal subset (CI gate)
pnpm e2e:critical
```

## 🔧 Operations
```bash
# Process pending Google Calendar sync jobs
pnpm calendar:sync
```

## 🚢 Deployment
```bash
# Standard deploy (build + Pages deploy)
pnpm deploy:prod

# Full deploy (push secrets + build + deploy)
pnpm deploy:prod:full
```

## 📚 Documentation
- **`AGENTS.md`** - Repo architecture notes and command map
- **`ops/runbooks/calendar-sync.md`** - Calendar sync queue operations

## 🔗 Related Packages
- **`packages/calendar`** - Calendar domain logic (storage, services, transports, migrations)
- **`repos/auth`** - Auth library used by this repo (its own README + tests)

## 📝 License
MIT
