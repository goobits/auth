# Changelog

<!-- CHANGELOG audit cutoff: 2026-06-24. commit 9037d71 on main. -->

## [Unreleased]

### UI

- Added `@goobits/auth/ui/qr-code` so QR-only consumers do not initialize the auth session store.

### 🔒 Security

- 🍪 Built-in session adapters now persist only SHA-256 verifiers, return bearer
  values solely to the cookie layer, reject open-ended metadata, and expose
  session management only through distinct non-secret handles.
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
- 🔑 Passkey credentials are insert-only by credential ID, signature counters
  advance through owner-bound compare-and-swap operations, and invalid or
  regressing counters fail before session creation.
- ✉️ Magic-link URLs require a canonical HTTPS origin; optional numeric codes
  are HMAC-bound to their normalized email with a deployment secret, and raw
  credentials reach only the configured delivery callback.
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
- 👤 Auth cryptographic operations delegate to `@goobits/security/crypto`;
  generic API-key and CSRF APIs are consumed directly from Security while
  Auth retains only authentication-specific session and token orchestration.
- 🧱 Authentication-specific login, registration, and password-reset limiter
  presets now have one owner in `@goobits/auth/security`; managed Auth policy and
  custom app routes consume the same multi-window limits.
- 🔔 Threshold alerts now use the shared Security mechanism and
  `warning | critical` vocabulary instead of maintaining a second counter and
  `warn | error` severity model in Auth.
- 🔑 OAuth token adapters now accept rotation-ready codecs/keyrings, bind new
  ciphertext to user and provider identity, read explicitly mapped legacy
  ciphertext, and lazily reseal retired-key payloads under the active key.
- 🧱 D1 and Drizzle OAuth token writes now require atomic `(user, provider)`
  upserts, preventing read-time resealing or concurrent login from deleting a
  valid token row.
- 🧱 Every configurable D1 table and column name now passes one strict
  identifier validator before SQL construction.
- 👥 Role resolution no longer trusts arbitrary `user.settings`; applications
  may provide one explicit `resolveAuthRoles` callback for trusted role data.
- 📜 The Auth-to-Security audit bridge omits free-form event messages and
  redacts structured detail before durable storage, preventing backend error
  text from becoming an accidental secret channel.

### 🏠 Internal

- 📦 Added `@goobits/auth/verification`, PostgreSQL verification-token storage,
  and a named `auth.routes` facade for clean application composition.
- 🔑 Added a provider-neutral password migration verifier so applications can
  retain read-only legacy schemes without duplicating upgrade orchestration.
- 🧱 Published public-user assertion and projection helpers for custom adapters
  so consumers share the same secret-field boundary as built-in adapters.
- 🔑 Verification-token hashing, record inspection, atomic consumption, and canonical token types now share one public utility boundary for application adapters and transactional account flows.
- 📦 Published entrypoints now resolve compiled Node/Worker JavaScript and declarations; the source-only security runtime is bundled at this distribution boundary, and smoke checks cover every export and the packed file list.
- 📦 First-party workspaces now consume Auth source directly while published
  packages retain compiled Node/Worker exports; package-private conditional
  imports keep password and WebAuthn runtime selection identical in both modes.
- 🧭 Removed the auth type cycle, stale source-entrypoint map, undeclared TypeScript script runner, unpinned API-map commands, unused `pg-server` fixture dependency, and accidental exports from private helpers.
- 📚 Public API docs now describe the curated package entrypoints and low-level subpaths.
- 📌 Runtime exports for every supported non-UI subpath are snapshot-pinned so
  accidental public/private API drift fails tests.
- 📦 Development dependencies refreshed for the current package toolchain.
- Removed generic `auditLog` and `withAuditLogging` exports from
  `@goobits/auth/security`; one awaited auth-event emitter now bridges all
  managed handlers to `@goobits/security/audit`.
- Removed Auth-owned Basic-auth and API-key helpers; generic HTTP credentials now
  live exclusively in `@goobits/security/http-credentials`.
- Removed auth-side reCAPTCHA verification. Use `@goobits/security/recaptcha` directly for structured CAPTCHA verification.
- Removed auth-side rate-limit mechanisms. Auth owns only authentication policy
  presets and delegates counters to `@goobits/security/rate-limit`.
- Removed the duplicate public Auth CSRF surface. Managed routes consume
  `@goobits/security/csrf/sveltekit` internally and applications import
  Security's CSRF APIs directly.
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
