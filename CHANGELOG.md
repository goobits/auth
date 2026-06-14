# Changelog

<!-- CHANGELOG audit cutoff: 2026-06-24. commit 9037d71 on main. -->

## [Unreleased]

### 🔒 Security

- 👤 Trusted proxy headers now require explicit trusted-header configuration before forwarded client IPs are accepted.
- 👤 OAuth routes no longer use the global OAuth POST fallback, and redirect endpoints enforce safer request paths.
- 👤 Auth error logging now avoids raw exception objects so sensitive provider, password, and token details are not emitted.
- 👤 Auth crypto-sensitive helpers for API keys, CSRF tokens, signed session tokens, token encryption, random bytes, and SHA-256 now use `@goobits/security/crypto` while preserving the auth-facing helper APIs.

### 🏠 Internal

- 📚 Public API docs now describe the curated package entrypoints and low-level subpaths.
- 📦 Development dependencies refreshed for the current package toolchain.
- Removed generic `auditLog` and `withAuditLogging` exports from `@goobits/auth/security`; generic audit logging now belongs to `@goobits/security/audit`, while auth keeps `auditAuthEvent` for auth-specific event names.
- Renamed auth-side API-key helpers from admin wording to `createAuthApiKey`, `hashAuthApiKey`, and `verifyAuthApiKey`; admin route authentication belongs to `@goobits/security/admin-auth`.
- Removed auth-side reCAPTCHA verification. Use `@goobits/security/recaptcha` directly for structured CAPTCHA verification.

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
