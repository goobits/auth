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
    alerts: {
      enabled: true,
      webhook: {
        url: env.SECURITY_WEBHOOK_URL,
        secret: env.SECURITY_WEBHOOK_SECRET,
      },
    },
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

## Defaults

These are the built-in defaults the library applies when you don't override
them. Every value here is configurable on the matching config block.

| Concern | Default | Override |
|---|---|---|
| Rate limit (general auth routes) | 20 requests / 60 s | `security.rateLimit.{max,windowMs}` |
| Rate limit (`strict` profile) | 10 requests / 60 s | `security.rateLimit.{max,windowMs}` |
| Magic link expiry | 15 minutes | `magicLink.settings.expiresInMs` |
| Magic link OTP length | 6 digits | `magicLink.settings.otpDigits` |
| Magic link verify rate limit | 5 attempts / 10 minutes | `magicLink.limits.{verifyMax,verifyWindowMs}` |
| WebAuthn challenge timeout | 60 seconds | `webauthn.timeoutMs` |
| Session lifetime (KV adapter) | 30 days | `KVSessionAdapter` constructor `sessionLifetime` |
| Session ID entropy | 160 bits (20 bytes, base64url) | n/a |
| OAuth state / PKCE | issued by `arctic`, single-use, cookie-bound | n/a |
| Argon2 (Cloudflare Workers, WASM) | 12 MiB memory, 2 iterations, 16-byte salt | not configurable — tune via fork if your edge runtime allows more |
| Argon2 (Node, `@node-rs/argon2`) | library defaults (≈ 19 MiB, 2 iterations) | not configurable in this release |

The WASM Argon2 parameters sit at the OWASP minimum — defensible for edge
runtimes with strict CPU budgets, but apps that can afford more should
rate-limit their login/signup routes aggressively to compensate.

## Required Production Checks

1. Set secure cookies in production.
2. Configure trusted proxy behavior explicitly.
3. Enable an alert sink with `security.alerts.webhook` or `security.alerts.onAlert`.
4. Validate secrets at deploy-time (`TOKEN_ENCRYPTION_KEY`, OAuth secrets).
5. Keep dependency and secret scanning enabled in CI.

## Alert Webhooks

The preferred configuration is explicit:

```ts
security: {
  alerts: {
    enabled: true,
    webhook: {
      url: env.SECURITY_WEBHOOK_URL,
      secret: env.SECURITY_WEBHOOK_SECRET,
      cooldownMs: 10 * 60 * 1000,
      maxPerHour: 10,
      timeoutMs: 5000,
    },
  },
}
```

For compatibility, `SECURITY_WEBHOOK_URL` and `SECURITY_WEBHOOK_SECRET` are
read from `process.env` when `security.alerts.webhook.url` or `.secret` is not
set. New integrations should pass the webhook config directly.
