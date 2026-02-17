# 🦖 pdx.run
SvelteKit site for PDX Dino Run, deployed on Cloudflare Pages with D1-backed form submissions.

## ✨ Key Features
- **☁️ Cloudflare Pages runtime** - `@sveltejs/adapter-cloudflare` build output at `.svelte-kit/cloudflare`
- **🗄️ D1 persistence** - store form submissions in Cloudflare D1
- **🛡️ Turnstile protection** - optional bot protection on public forms
- **🧭 Internal routes** - attendee/volunteer/donate/routes/code-of-conduct/thanks pages
- **🧪 Tests** - Vitest unit tests + Playwright e2e tests
- **🔧 Strict lint/typecheck** - ESLint (type-aware) + `svelte-check`

## 🚀 Quick Start
```bash
# Requirements
# - Node.js: see package.json#engines
# - pnpm: see package.json#packageManager

pnpm install

# Local D1 (Wrangler) migrations
pnpm db:migrate:local

# Cloudflare Pages local runtime (recommended for full functionality)
pnpm cf:dev
# http://127.0.0.1:3580
```

## 🌐 App Routes
- **`/`** - homepage
- **`/join`** - attendee signup (writes to D1)
- **`/volunteer`** - volunteer signup (writes to D1)
- **`/donate`** - donation options
- **`/routes`** - route details + downloads
- **`/code-of-conduct`** - event conduct policy
- **`/thanks`** - post-submit confirmation

## ⚙️ Configuration
```bash
# Cloudflare bindings are configured in wrangler.toml
# - D1 binding name: DB
# - nodejs_compat enabled

# Turnstile (set in Cloudflare Pages env vars or local env)
PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# Optional: bypass Turnstile for local testing only
TURNSTILE_BYPASS=true
```

## 🛠️ Cloudflare Pages Build Settings
- **Framework preset**: `None`
- **Build command**: `pnpm install --frozen-lockfile && pnpm build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Root directory**: `/`

## 🧪 Development
```bash
# Lint + typecheck + build
pnpm validate

# Unit tests
pnpm test:unit

# E2E tests
pnpm exec playwright install
pnpm test:e2e

# Everything
pnpm test:all
```

## 📖 Documentation
- **`CHANGELOG.md`** - release notes
- **`README.md`** - setup, routes, and Cloudflare build settings

## 🗂️ Project Layout
- `src/routes/` - page and server routes
- `src/lib/content/site.ts` - canonical homepage content
- `src/lib/components/` - section components
- `src/lib/styles/` - design tokens + BEM SCSS
- `src/lib/server/submissions.ts` - form validation + D1 persistence
- `migrations/` - D1 schema migrations
- `static/` - static assets, route files, OG image
- `__tests__/unit/` - unit tests
- `__tests__/e2e/` - browser interaction tests
