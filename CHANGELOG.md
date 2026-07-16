# Changelog

<!-- CHANGELOG audit cutoff: 2026-06-24. commit 9037d71 on main. -->

## [Unreleased]

### 🔒 Security

- 🔐 Password hashes now cross only the dedicated `PasswordCredentialAdapter`
  capability; general user/profile adapters remain sanitized and password-blind.
- 🔁 Password-reset completion is application-owned and atomic: consume the
  hashed token, update the hash, and invalidate existing sessions as one unit.
- 🎟️ Verification tokens, magic-link tokens, and WebAuthn challenges now require
  atomic single-use adapter operations with no replay-prone compatibility fallback.
- 🧵 Logger configuration is instance-scoped; constructing one auth instance no
  longer changes another instance's logging behavior.
- 👤 MFA enrollment and removal now require application-owned fresh
  reauthentication; factor setup is atomic, enabled factors cannot be replaced,
  and backup-code use fails closed on concurrent consumption.
- 🔑 Passkey registration now requires application-owned fresh
  reauthentication and rejects challenge verification under a different principal.
- 🛡️ Drizzle, D1, KV, and PostgreSQL session adapters now persist MFA assurance
  across validation, refresh, and session-listing round trips.
- 🔐 PostgreSQL MFA storage now requires an application-owned encryption codec;
  plaintext secrets and implicit plaintext fallback are rejected.
- 🧱 The secure profile now requires built-in CSRF or an explicit outer request
  boundary, production profiles require shared policy stores, and the browser
  client uses `@goobits/security/csrf-client` for unsafe same-origin requests.
- 🧮 Password work now has a 1024-character absolute ceiling, MFA comparisons
  use shared constant-time primitives with bounded TOTP windows, and security-owned
  signup/session metadata can no longer be overridden by extension metadata.
- 👤 Custom application auth routes can now emit outcomes through the same configured audit, threshold, and alert pipeline as Goobits-managed routes.
- 👤 Trusted proxy headers now require explicit trusted-header configuration before forwarded client IPs are accepted.
- 🧭 Standalone auth handlers now share one rate-limit key resolver; the
  ambiguous `trustProxyHeader` switch was removed in favor of exact managed
  `trustedProxyHeaders` or an application-owned `rateLimit.key` callback.
- 👤 OAuth routes no longer use the global OAuth POST fallback, and redirect endpoints enforce safer request paths.
- 👤 Auth error logging now avoids raw exception objects so sensitive provider, password, and token details are not emitted.
- 👤 Auth crypto-sensitive helpers for API keys, CSRF tokens, signed session tokens, token encryption, random bytes, and SHA-256 now use `@goobits/security/crypto` while preserving the auth-facing helper APIs.
- 🧱 Authentication-specific login, registration, and password-reset limiter
  presets now have one owner in `@goobits/auth/security`; managed Auth policy and
  custom app routes consume the same multi-window limits.
- 🔔 Threshold alerts now use the shared Security mechanism and
  `warning | critical` vocabulary instead of maintaining a second counter and
  `warn | error` severity model in Auth.

### 🏠 Internal

- 📦 Added `@goobits/auth/verification`, PostgreSQL verification-token storage,
  and a named `auth.routes` facade for clean application composition.
- 🔑 Added a provider-neutral password migration verifier so applications can
  retain read-only legacy schemes without duplicating upgrade orchestration.
- 🧱 Published public-user assertion and projection helpers for custom adapters
  so consumers share the same secret-field boundary as built-in adapters.
- 🔑 Verification-token hashing, record inspection, atomic consumption, and canonical token types now share one public utility boundary for application adapters and transactional account flows.
- 📦 Published entrypoints now resolve compiled Node/Worker JavaScript and declarations; the source-only security runtime is bundled at this distribution boundary, and smoke checks cover every export and the packed file list.
- 🧭 Removed the auth type cycle, stale source-entrypoint map, undeclared TypeScript script runner, unpinned API-map commands, unused `pg-server` fixture dependency, and accidental exports from private helpers.
- 📚 Public API docs now describe the curated package entrypoints and low-level subpaths.
- 📦 Development dependencies refreshed for the current package toolchain.
- Removed generic `auditLog` and `withAuditLogging` exports from `@goobits/auth/security`; generic audit logging now belongs to `@goobits/security/audit`, while auth keeps `auditAuthEvent` for auth-specific event names.
- Removed Auth-owned Basic-auth and API-key helpers; generic HTTP credentials now
  live exclusively in `@goobits/security/http-credentials`.
- Removed auth-side reCAPTCHA verification. Use `@goobits/security/recaptcha` directly for structured CAPTCHA verification.
- Removed auth-side rate-limit mechanisms. Auth owns only authentication policy
  presets and delegates counters to `@goobits/security/rate-limit`.
- Routed auth-side CSRF issuance and validation through `@goobits/security/csrf`; auth keeps only SvelteKit cookie ergonomics.
- Removed auth-side webhook alert transport. Auth threshold alerts now dispatch through `@goobits/security/alerting`.
- Removed the unused migration notification UI export.

## 0.2.0

- Added the class-first `GoobitsAuth` API.
- Made `GoobitsAuth` the package-root API and kept the lower-level `createAuth` engine internal.
- Added Node HTTP helpers through `@goobits/auth/node`.
- Added shared Basic auth and signed session-token helpers through `@goobits/auth/security`.
- Added memory and PostgreSQL adapter bundles.
- Added security helpers, MFA utilities, and UI exports.
- Trimmed broad utility/security exports to the intentional public helpers.
- Updated the UI auth store to use generic auth endpoint names, generic request headers, and `{ user, session }` response data.
- Curated public subpaths: removed duplicate adapter, handler, client, utility, testing, and errors entry points; exported password helpers from `@goobits/auth/password`.
- Moved mock adapters to `@goobits/auth/adapters/memory`.
- Removed app-specific forum fields from the published `User` type.
