# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-17

### Added
- Social-first calendar experience with event feed actions (`Join`, `Join +1`, `Waitlist`, `Leave`), facepile participants, and memory recap support.
- Dynamic, database-backed calendar programs with admin CRUD and slug-driven member routes.
- Async Google Calendar sync queue with admin queue health, retries, dead-letter handling, and recovery actions.
- Expanded E2E coverage for calendar/admin/auth/sitemap flows, including contention, dead links/images, and sync queue smoke checks.

### Changed
- Reworked admin information architecture to URL-backed sections (overview, availability, events, programs, members, integrations) with persistent deep links.
- Refactored calendar/admin UI into shared shell/page components and centralized transport parsing to reduce duplication.
- Moved calendar domain logic into package-owned services and slimmed route handlers into a thin application layer.
- Consolidated ops tooling under `ops/` and aligned cron/deploy workflows with forward-only structure.

### Fixed
- Corrected admin login submit behavior and session stickiness issues in local dev.
- Fixed sitemap route clickability and multiple dead image/dead link regressions across journal and related pages.
- Fixed calendar button state styling regressions where enabled actions could appear visually disabled.

### Security
- Enforced strict OAuth callback state validation and removed legacy auth/signin callback compatibility paths.
- Tightened API response validation/logging paths and eliminated unsafe compatibility casts in sync/auth flow.

## [1.1.0] - 2026-02-04

### Added
- Cloudflare Workers support with crypto module stubs for argon2/bcrypt
- `dev:wrangler` script for local Cloudflare Workers development
- Playwright for end-to-end testing
- TypeScript configuration and full codebase migration to TypeScript
- Rainbow Gym booking calendar with cancel functionality
- BookingCalendar shared component with reusable styles
- Admin dashboard with booking management
- Session-based admin authentication
- OAuth authentication (Google, Apple) for Rainbow invite-only access
- Cancel booking service with secure cancel tokens
- Theme system with dark mode support
- Sitemap page with automatic route discovery
- D1 database integration for Cloudflare Pages

### Changed
- Migrated from Yarn to pnpm
- Migrated to Cloudflare Pages deployment
- Migrated calendar auth to @goobits/auth package
- Improved Rainbow layout with auth redirect and navigation structure
- Restyled Rainbow pages with dark sleek design
- Enhanced admin dashboard with colors and icons

### Fixed
- Cancel modal accessibility (proper ARIA roles, Escape key handling)
- Logout page prerender issue
- Cloudflare Pages _routes.json deployment error
- Admin session TTL configuration parsing
- Svelte a11y warnings

### Security
- Hardened admin API error handling and input validation
- Hardened calendar API input validation and error handling
- Rewrote email handler with security hardening
- Added redirect validation for calendar auth
