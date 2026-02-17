# Changelog

All notable changes to this project will be documented in this file.

This project aims to follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-17

### Added

- Cloudflare Pages deployment support (Wrangler) and local Pages runtime (`pnpm cf:dev` on port `3580`).
- Internal app routes: `/join`, `/volunteer`, `/donate`, `/routes`, `/code-of-conduct`, `/thanks`.
- D1-backed form submissions and Cloudflare runtime configuration.
- Turnstile protection for public forms to reduce abuse.
- CI workflows for validation and tests.
- Test suite: Vitest (unit) + Playwright (e2e) for core user flows.
- `@goobits/auth` integrated as a workspace package for future account/admin flows.

### Changed

- Repo layout flattened so the app lives at the repo root.
- CSS refactored to a BEM architecture with design tokens.
- Documentation updated to avoid hardcoding tool versions (source from `package.json`).

## [0.0.1] - 2026-02-15

### Added

- Initial project scaffold.

