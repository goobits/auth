# Changelog

<!-- CHANGELOG audit cutoff: 2026-06-24. commit 9037d71 on main. -->

## [Unreleased]

### 🔒 Security

- 👤 Trusted proxy headers now require explicit trusted-header configuration before forwarded client IPs are accepted.
- 👤 OAuth routes no longer use the global OAuth POST fallback, and redirect endpoints enforce safer request paths.
- 👤 Auth error logging now avoids raw exception objects so sensitive provider, password, and token details are not emitted.

### 🏠 Internal

- 📚 Public API docs now describe the curated package entrypoints and low-level subpaths.
- 📦 Development dependencies refreshed for the current package toolchain.

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
