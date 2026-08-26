# Changelog

<!-- CHANGELOG audit cutoff: 2026-08-02. commit 6d654d5c on main. -->

## [Unreleased]

### 🐛 Fixed

- Active-session management now renders its loading state during server-side
  output instead of briefly claiming that no sessions exist before hydration.
- Published packages now declare `jose` directly because the bundled Security
  JWT implementation imports it at runtime; isolated package installs no
  longer rely on a workspace-only transitive dependency.

### ⚠️ Breaking

- 🔐 `MfaAdapter.activateEnrollment()` now receives the matched TOTP counter,
  and adapters must implement atomic `consumeTotpCounter()`. Persistent factor
  tables need nullable `last_used_counter` storage before this revision is
  deployed.
- 🧱 Standalone `createMfaLoginVerifyHandler()` now requires both CSRF and rate
  limiting or an executable `validateExternalSecurityBoundary`, matching the
  existing standalone sign-in, signup, and password-reset contract.

### 🔒 Security

- 🔑 Conditional passkey option creation now uses a separate bounded challenge
  budget, so passive browser autofill does not consume the stricter credential
  verification attempt budget.
- 🎨 `OAuthProviderButton` now ships its Google and Apple marks and uses local
  system fonts, eliminating third-party image and font requests during render.
- 🧭 OAuth callbacks now distinguish state-bound cancellation, malformed input,
  provider rejection, and upstream outage without leaking provider-controlled
  descriptions through exception messages or turning expected failures into
  internal-server errors.
- 🔐 Managed OAuth and magic-link authentication can now share the same
  single-use MFA login gate as password authentication; no session is exposed
  until enabled TOTP or a backup code is verified, while passkey login retains
  explicit MFA assurance.
- 🧱 Managed login MFA now rejects manual session mode at startup so application
  hooks cannot expose a session before the second-factor gate executes.
- 🧭 `hooks.beforeSessionCreate` now gives applications one post-assurance,
  pre-session boundary for access and login-completion policy without repeating
  Auth's MFA decision.
- 🔁 TOTP proofs now carry their RFC 6238 counter through an atomic monotonic
  consume, preventing successful-code replay and concurrent double use without
  narrowing the normal clock-skew window.
- 🧩 MFA activation and removal can use the existing application credential
  mutation port, allowing proof state, factors, sessions, and audit rows to
  commit together without a duplicate hook path.
- 🔗 MFA login can use an optional `completeLogin` transaction port to consume
  the challenge and one-time proof in the same commit that creates the session.

### 🧰 Tooling

- Build output, coverage, and Vite caches now live beneath the operating
  system's temporary directory (or an absolute `GOOBITS_CACHE_ROOT` outside the
  project); `dist` remains available through a managed external symlink for
  packaging and smoke tests.
- Package archives materialize `dist` only while packing, then restore the
  managed symlink so published JavaScript and declarations are included.

## [0.6.0] - 2026-08-03

### ⚠️ Breaking

- 🔒 Managed CSRF now requires `security.csrf.secret` and Security 4. Tokens
  are HMAC-signed and rotate when the validated Auth session changes.
- 🧭 Managed unsafe routes now enforce Security's request-origin verifier by
  default. Replace `csrf.validateExternalSecurityBoundary` with
  `requestOrigin.validate`; Apple OAuth callbacks remain state/nonce-bound and
  are explicitly exempt from same-origin enforcement for `form_post`.
- 🔑 `OAuthProvider.config` was removed. `auth.providers` now exposes frozen,
  secret-free `{ name, callbackMode }` metadata instead of live provider
  instances. Custom providers must call `super(name)` and retain credentials in
  ECMAScript `#private` fields.

### 📦 Distribution

- Node server bundlers can import `ARGON2_NATIVE_PACKAGE_IDS` from the
  node-only `@goobits/auth/password/native-packages` subpath to externalize the
  exact native Argon2 package set without duplicating dependency knowledge.

### 🔒 Security

- 🍎 Apple JWKS refreshes now occur only for an unknown key ID, share one
  in-flight fetch, apply cooldown/backoff, and retain stale keys during bounded
  provider outages. Invalid known-key signatures no longer trigger network I/O.
- 🔐 Google client secrets and Apple signing keys are held only in
  runtime-private fields and cannot leak through ordinary object or Auth facade
  serialization.
- 🧱 Secure and strict profiles enforce request-origin validation independently
  of token CSRF; strict continues to require both boundaries.

See [`docs/migrations/0.6-breaking.md`](docs/migrations/0.6-breaking.md).

## [0.5.1] - 2026-08-03

### 🔒 Security

- 🔑 The primary `GoobitsAuthConfig` facade now preserves the feature-to-adapter
  type correlation, and runtime configuration fails at startup when passkey
  registration receives a storage-only adapter without the atomic credential
  creation capability.

## [0.5.0] - 2026-08-03

### ⚠️ Breaking

- 🔑 Passkey registration now requires a `WebAuthnRegistrationAdapter` with an
  application-owned `createCredentialWithinLimit()` persistence capability.
  The race-prone base list-then-insert fallback was removed. Database-backed
  adapters remain reusable for authentication and management, but must be
  composed with an atomic transaction or lock before registration is enabled.
  See [`docs/migrations/0.5-breaking.md`](docs/migrations/0.5-breaking.md).

### 🌟 Highlights

- 👤 OAuth identity ownership now uses stable provider subjects and explicit
  sign-in, link, reauthentication, and unlink flows.
- 👤 Sessions persist only bearer-token verifiers and expose separate
  management handles.
- 👤 Password hashes cross only the dedicated credential capability.
- 👤 MFA, passkey, and OAuth identity changes require application-owned fresh
  authorization.
- 📦 Node and Worker distributions publish compiled runtime entrypoints with
  package smoke coverage.

### ✨ Added

- 🎨 `OAuthProviderButton` provides one localized, accessible Google and
  Apple brand treatment through `@goobits/auth/ui` for login and account-linking
  surfaces.
- 🧩 The `@goobits/auth/ui/qr-code` subpath lets QR-only consumers avoid
  initializing the auth session store.
- 🪟 Backup-code dialogs now contain keyboard focus through their package-private
  modal boundary, restore the opener focus, reset transient state on every
  opening, expose a labelled dialog, and provide 44px minimum action targets.
- 👤 Conditional passkey mediation is available through a capability probe and
  abortable client login ceremony.

### 🔧 Changed

- 🧭 `loginWithOAuth` now accepts the same optional application-relative return
  path as provider linking and reauthentication.
- 👤 ⚠️ Managed authentication hooks now use one typed `onAuthentication`
  lifecycle, and OAuth persistence uses the dedicated `OAuthIdentityAdapter`.
- 👤 ⚠️ OAuth uses only canonical sign-in, link, reauthentication, callback,
  identity-management, and signout routes.

### 🔒 Security

- 📦 Managed JSON and form endpoints now parse through Security's bounded
  request-body readers and return an audited `413` when the limit is exceeded.
- 🪪 OAuth callbacks reject provider subjects whose surrounding whitespace would
  change stable identity ownership.
- 🧭 Unknown OAuth flow intents now return `400` instead of surfacing as server
  errors.
- 🔄 Added a principal-bound session-assurance rotator that refreshes primary
  or MFA verification independently while preserving trusted session context.
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
  regressing counters fail before session creation. Registration adapters must
  enforce account caps atomically, and failed application lifecycle hooks roll
  back the newly stored credential.
- ✉️ Magic-link URLs require a canonical HTTPS origin; optional numeric codes
  are HMAC-bound to their normalized email with a deployment secret, and raw
  credentials reach only the configured delivery callback.
- 🛡️ Drizzle, D1, KV, and PostgreSQL session adapters now persist MFA assurance
  across validation, refresh, and session-listing round trips.
- 🔐 PostgreSQL MFA storage now requires an application-owned encryption codec;
  plaintext secrets and implicit plaintext fallback are rejected. The
  PostgreSQL bundle exposes the MFA capability only when that codec is supplied,
  so applications that do not enable TOTP need no unused encryption key.
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
- 🔑 New MFA backup codes use independently salted, versioned PBKDF2 hashes.
  Verification temporarily accepts the former unprefixed SHA-256 format so
  deployed codes can be consumed during the v8 regeneration window.
- 🧭 Append-style `X-Forwarded-For` chains can now select a client address by
  an explicit trusted-proxy hop count, while malformed hop configuration and
  undersized chains fail closed.
- 🧱 Managed forms use Security's canonical `csrf_token` field. Optional CSRF
  mode now validates unsafe requests whenever its CSRF cookie is present.
- 🍎 Apple sign-in requires a signed email-verification claim in either the
  boolean or string form Apple emits.
- 👤 OAuth sign-in never selects an account by email; provider linking and
  unlinking require fresh authorization and revoke retained tokens first.
- 🍎 Apple ID tokens are verified with issuer, audience, time, nonce, and
  bounded JWKS checks; Google identity is sourced from the OIDC `sub` claim.
- 🍎 Apple server-to-server account notifications have one verified, bounded
  parser while applications retain durable replay, ordering, and deletion policy.
- 🧭 OAuth state, PKCE, Google exchange, and Apple client-secret signing now use
  Web Crypto and bounded Fetch requests; the deprecated `arctic` dependency
  and its compatibility branches were removed.
- 📦 Node request streams now use Security's shared bounded body reader with a
  1 MiB default ceiling.

### 🏠 Internal

- Reconciled the public and first-party integration histories into one
  canonical package line and made shared documentation and test fixtures
  consumer-neutral.
- Auth route handlers now use Auth's structural request-event contract instead
  of inheriting an ambient application's SvelteKit `App.Locals` declaration.
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
- 📦 Memory and PostgreSQL adapter factories now forward an optional
  `sessionLifetimeMs`, and emitted `dist` JavaScript carries its own ESM package
  scope when managed build storage resolves outside the source tree.
- 📦 The standalone Auth workspace now includes its Keyboard sibling, and the
  test worker pool is capped locally to avoid resource spikes.
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
