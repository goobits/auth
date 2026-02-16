# Test Plan

## Scope audited (interactive surface)

- Internal routes: `/`, `/join`, `/volunteer`, `/donate`, `/routes`, `/code-of-conduct`, `/thanks`
- Form submissions:
  - `POST /join`
  - `POST /volunteer`
  - `POST /api/remind`
- Server-side behavior:
  - Input validation
  - Honeypot rejection
  - D1 persistence calls
  - Thanks-page type normalization

## Test suite structure

- `__tests__/unit/`
  - Fast logic tests using Vitest
  - Targets validators, submission service behavior, and thanks-load mapping
- `__tests__/e2e/`
  - User flows using Playwright against Cloudflare runtime (`pnpm cf:dev`)
  - Covers live route rendering and real form submit redirects

## Why this split

- Unit tests keep validation and service regressions cheap to catch.
- E2E tests ensure form wiring and redirects work in production-like runtime.
- Coverage stays focused on real interactions and avoids shallow/superfluous tests.
