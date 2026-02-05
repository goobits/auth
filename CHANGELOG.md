# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
