# Security Contract

This package enforces authentication primitives and secure defaults, while authorization and deployment controls remain application responsibilities.

## Profiles

- `basic`:
  CSRF `off`, rate limit `optional`, audit `optional`.
- `secure` (recommended default):
  CSRF `required`, rate limit `required`, audit `required`, alerts enabled.
- `strict`:
  CSRF `required`, rate limit `required`, audit `required`, alerts enabled.

## Security configuration

Use the [quickstart](./quickstart.md) for complete `GoobitsAuth` setup. The
fragment below shows only the security-specific options:

```ts
security: {
	rateLimit: { store: sharedRateLimitStore },
	audit: { emitter: auditEmitter },
	alerts: {
		enabled: true,
		webhook: { url: env.SECURITY_WEBHOOK_URL }
	}
}
```

Applications with a single, application-wide request-origin guard may use
`csrf: { mode: 'off', validateExternalSecurityBoundary: verifyOrigin }` under
the `secure` profile. Auth executes that validator for every unsafe request and
fails closed when it rejects. The `strict` profile always requires built-in
CSRF.

Built-in forms use the Security-owned defaults: cookie `csrf-token`, header
`X-CSRF-Token`, and form or JSON field `csrf_token`. Optional mode leaves
cookie-less unsafe requests alone, but once the CSRF cookie exists it requires a
matching token instead of silently bypassing validation.

## Responsibilities

- Library provides:
  - principal resolution and session lifecycle guarantees
  - credential MFA challenges that create no session before the second factor
  - session-level MFA assurance metadata after a successful second factor
  - CSRF/rate-limit policy wiring powered by `@goobits/security`
  - auth event emission + threshold alerts
  - authorization helper primitives
- Application must provide:
  - route-level authorization policy decisions
  - fresh reauthentication for MFA enrollment and removal through
    `mfa.authorizeSecurityChange`
  - fresh reauthentication for passkey registration through
    `webauthn.authorizeSecurityChange`
  - migration of custom session storage to persist optional assurance metadata
    before privileged routes rely on it
  - when TOTP is enabled, an MFA secret codec backed by
    `@goobits/security/crypto` or a managed KMS, including key rotation
  - a shared production rate-limit store; strict or expiry-checked CSRF also
    requires a shared CSRF store
  - CSRF plus rate limiting for standalone credential handlers, or one
    executable application boundary that enforces equivalent controls before
    every request
  - generic route audit logging through `@goobits/security/audit`
  - security headers, TLS/HSTS/CSP at app/edge layer
  - secrets management and key rotation

## Defaults

These are the built-in defaults the library applies when you don't override
them. Every value here is configurable on the matching config block.

| Concern                           | Default                                      | Override                                                          |
| --------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| Managed auth route rate limit     | 5 / minute and 15 / 15 minutes               | `security.rateLimit.windows`                                      |
| Registration policy preset        | 3 / 10 minutes and 5 / hour                  | app-supplied limiter config                                       |
| Password-reset policy preset      | 3 / 15 minutes and 5 / hour                  | app-supplied limiter config                                       |
| Magic link expiry                 | 15 minutes                                   | `magicLink.settings.expiresInMs`                                  |
| Magic link OTP length             | 6 digits                                     | `magicLink.settings.otpDigits`                                    |
| Magic link verify rate limit      | 5 / minute and 15 / 15 minutes               | `magicLink.limits.verify`                                         |
| WebAuthn challenge timeout        | 60 seconds                                   | `webauthn.timeoutMs`                                              |
| Session lifetime (KV adapter)     | 30 days                                      | `KVSessionAdapter` constructor `sessionLifetime`                  |
| Session bearer entropy            | 256 bits (32 bytes, base64url)               | n/a                                                               |
| Absolute password input length    | 1024 characters                              | n/a                                                               |
| OAuth state / PKCE                | issued by `arctic`, single-use, cookie-bound | n/a                                                               |
| Argon2 (Cloudflare Workers, WASM) | 12 MiB memory, 3 iterations, 16-byte salt    | not configurable — tune via fork if your edge runtime allows more |
| Argon2 (Node, `@node-rs/argon2`)  | library defaults (≈ 19 MiB, 2 iterations)    | not configurable in this release                                  |

The WASM Argon2 parameters sit at the OWASP minimum — defensible for edge
runtimes with strict CPU budgets, but apps that can afford more should
rate-limit their login/signup routes aggressively to compensate.

## Required Production Checks

1. Set secure cookies in production.
2. Allowlist only proxy headers that the trusted edge overwrites; standalone
   handler key callbacks must enforce the same boundary.
3. Enable an alert sink with `security.alerts.webhook` or `security.alerts.onAlert`.
4. Validate secrets at deploy-time (`TOKEN_ENCRYPTION_KEYRING`, OAuth secrets).
5. Keep dependency and secret scanning enabled in CI.
6. Configure shared rate-limit state before using `secure` or `strict` in production.
7. Configure an awaited audit emitter before using `secure` or `strict` in production.

For a proxy that replaces `X-Forwarded-For` with one client address, allowlist
the header without a hop count. For an append-style chain, also set
`security.rateLimit.forwardedForTrustedProxyHops` to the exact number of trusted
server-side hops. Auth then resolves from the right edge of the chain and
rejects a chain that is too short; it never trusts a spoofable leftmost entry by
accident.

Use `createAuthEventAuditEmitter()` to bridge Auth events into a canonical
`@goobits/security/audit` logger. The bridge redacts structured detail and does
not persist free-form event messages, because backend exception text is not a
safe audit field.

Custom rate-limit policy uses `security.rateLimit.windows` or the named
factories from `@goobits/auth/security`.

Password-length enforcement runs before built-in or application-supplied
hash/verify functions. TOTP verification accepts integer windows from 0 through
10 and evaluates every candidate with the shared constant-time comparison
primitive.

New backup-code hashes use the `v2:<salt>:<pbkdf2>` format. The v8 migration
reader accepts earlier unprefixed SHA-256 hashes only long enough for existing
codes to be used or regenerated. Applications should rotate outstanding backup
codes during v8 and remove the legacy reader only after storage confirms that no
legacy hashes remain.

## Alert Webhooks

The preferred configuration is explicit:

```ts
security: {
  alerts: {
    enabled: true,
    webhook: {
      url: env.SECURITY_WEBHOOK_URL,
    },
  },
}
```

`SECURITY_WEBHOOK_URL` is read from `process.env` when
`security.alerts.webhook.url` is not set. New integrations should pass the
webhook config directly. Use `security.alerts.onAlert` for custom signing,
cooldown, or fan-out behavior.
