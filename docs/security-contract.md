# Security Contract

This package enforces authentication primitives and secure defaults, while authorization and deployment controls remain application responsibilities.

## Profiles

- `basic`:
  CSRF `off`, rate limit `optional`, audit `optional`.
- `secure` (recommended default):
  CSRF `optional`, rate limit `required`, audit `required`, alerts enabled.
- `strict`:
  CSRF `required`, rate limit `required`, audit `required`, alerts enabled.

## Setup

```ts
import { GoobitsAuth } from "@goobits/auth";

const auth = new GoobitsAuth({
  profile: "secure",
  adapter,
  security: {
    alerts: { enabled: true },
  },
});
```

## Responsibilities

- Library provides:
  - principal resolution and session lifecycle guarantees
  - CSRF/rate-limit/audit policy wrappers
  - auth event emission + threshold alerts
  - authorization helper primitives
- Application must provide:
  - route-level authorization policy decisions
  - security headers, TLS/HSTS/CSP at app/edge layer
  - secrets management and key rotation

## Required Production Checks

1. Set secure cookies in production.
2. Configure trusted proxy behavior explicitly.
3. Enable alert sink (`SECURITY_WEBHOOK_URL` or custom `alerts.onAlert`).
4. Validate secrets at deploy-time (`TOKEN_ENCRYPTION_KEY`, OAuth secrets).
5. Keep dependency and secret scanning enabled in CI.
