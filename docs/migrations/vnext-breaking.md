# vNext Breaking Migration

## Summary

- Primary API is now `new GoobitsAuth({...})`.
- Preferred adapter key is singular: `adapter`.
- `drizzleAdapter(db, { schema })` is the one-stop Drizzle bundle.
- `DatabaseAdapter` has been renamed to `UserAdapter`.
- Adapter base classes are `abstract` and enforce compile-time implementation.
- Logout handlers are `RequestHandler`-first.
- MFA factor mutations require application-owned step-up authorization and
  atomic adapter methods.
- Password hashes moved from `UserAdapter` to the dedicated
  `PasswordCredentialAdapter` capability.
- Verification helpers moved from `@goobits/auth/utils` to
  `@goobits/auth/verification`.
- Generic HTTP credentials, cryptography, logging, and redaction are imported
  directly from `@goobits/security`; Auth no longer re-exports them.

## Before/After

### Auth instance

Before (pre-vNext — `createAuth` was a public root export):

```ts
// No longer resolvable: `createAuth` is internal as of 0.2.0.
import { createAuth } from '@goobits/auth'

const auth = createAuth({
	adapters: { session, user, oauthToken },
	providers: { google: { provider: googleProvider } }
})
```

After:

```ts
import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'

const auth = new GoobitsAuth({
	adapter: drizzleAdapter(db, { schema }),
	providers: { google: { provider: googleProvider } }
})
```

### SvelteKit plumbing

Before (manual hook + route handlers):

```ts
// custom cookie/session plumbing in hooks and routes
```

After:

```ts
// hooks.server.ts
export const handle = auth.handle()

// routes/auth/[...auth]/+server.ts
export const { GET, POST } = auth.handlers
```

### Adapter naming

Before:

```ts
adapters: {
  session,
  database: userAdapter,
}
```

After:

```ts
adapter: {
  session,
  user: userAdapter,
}
```

### Password credential boundary

Before:

```ts
userAdapter.getUserWithPasswordHash(email)
```

After:

```ts
passwordCredentialAdapter.findPasswordCredential(email)
passwordCredentialAdapter.updatePasswordHash(userId, passwordHash)
```

Remove password fields from general `createUser` and `updateUser` calls. Pass a
`PasswordCredentialAdapter` explicitly to credential handlers, or use the
`passwordCredential` capability returned by a prebuilt adapter bundle.

### Verification utilities

Before:

```ts
import { hashVerificationToken } from '@goobits/auth/utils'
```

After:

```ts
import { hashVerificationToken } from '@goobits/auth/verification'
```

### Generic security primitives

Import Basic-auth and API-key helpers from
`@goobits/security/http-credentials`, constant-time and encryption helpers from
`@goobits/security/crypto`, loggers from `@goobits/security/logger`, and
redaction from `@goobits/security/redaction`.

## Testing utilities

`@goobits/auth/testing` exports mock adapters:

- `MockSessionAdapter`
- `MockUserAdapter`
- `MockTokenAdapter`

## MFA factor lifecycle

`TotpMfaConfig.authorizeSecurityChange` is now required. The callback receives
the authenticated user ID, mutation action, and an independent request clone;
return `true` only after verifying a fresh application credential.

Custom `MfaAdapter` implementations must replace the separate `setSecret`,
`setBackupCodes`, and `enableMfa` operations with atomic
`beginEnrollment`/`activateEnrollment` methods. `disableMfa` and
`consumeBackupCode` now return whether their guarded delete succeeded. This
prevents active-factor replacement and backup-code replay races without
compatibility wrappers that preserve unsafe behavior.

`WebAuthnConfig.authorizeSecurityChange` is also required. Registration options
are issued only after that callback succeeds, and the resulting challenge may
only be verified by the same authenticated principal.

## Session assurance persistence

Persistent adapters now round-trip `Session.mfaVerifiedAt`. Add a nullable
`mfa_verified_at` timestamp to existing Drizzle and D1 session tables before
deploying this version. The PostgreSQL bundle's `pgAuthSchemaSql` includes an
idempotent `ALTER TABLE`; KV records need no migration. D1 applications must
explicitly set `columns.mfaVerifiedAt` to the migrated column when they use
session assurance; the compatibility default is `null`.

## PostgreSQL MFA encryption

`PgMfaAdapter` and `createPgAuthAdapters` now require an `mfaSecretCodec`.
Encrypt every existing `auth_mfa_factors.secret` value with the selected codec
before deploying this version, and verify the migration from a snapshot. There
is intentionally no plaintext compatibility fallback: unreadable legacy rows
must be migrated or their owners must re-enroll. Bind the user ID as
authenticated context and retain old decryption keys for controlled rotation.

## Secure profile boundaries

The `secure` profile now requires built-in CSRF by default. If an application
already enforces an equivalent origin boundary before every auth route, disable
the built-in check only with
`csrf: { mode: 'off', externalBoundary: true }`. Production `secure` and
`strict` profiles also require an explicit shared rate-limit store; `strict`
requires a shared CSRF store because it validates token expiry. The browser
client now echoes same-origin CSRF cookies through
`@goobits/security/csrf-client` automatically.

## Credential input hardening

Credential operations now reject passwords above 1024 characters before any
database lookup, custom validator, hash, or verification work. Signup metadata
can no longer override the computed password hash, email provider, or initial
verification state. Session metadata extensions cannot set MFA assurance or
replace request-derived remember-me, IP, and user-agent values.

## Atomic password reset completion

`createPasswordResetConfirmHandler` now requires
`completePasswordReset({ tokenHash, passwordHash })`. Implement it as one
application-owned transaction that consumes the hashed reset token, updates the
password hash, and invalidates every existing session. The old adapter sequence
is intentionally unsupported because token consumption and password mutation
could partially succeed or race.

## Required atomic token consumption

`MagicLinkAdapter.consumeByTokenHash`,
`MagicLinkAdapter.consumeByEmailAndOtpHash`,
`VerificationTokenAdapter.consumeByToken`, and
`WebAuthnAdapter.consumeChallenge` are abstract and must be backed by an atomic
consume operation. Remove custom adapters that inherit a find-then-delete
fallback; no such fallback remains.

`VerificationTokenAdapter.replaceForUserAndType` is also required. Add a unique
constraint on `(user_id, type)` and implement replacement as one upsert or
transaction. Token metadata must be stored and returned so MFA and other
multi-request challenges do not lose server-owned authorization context.

## Proxy rate-limit keys

The boolean `security.rateLimit.trustProxyHeader` and
`magicLink.settings.trustProxyHeader` options were removed. Configure the
central policy with an explicit `security.rateLimit.trustedProxyHeaders` list
only for headers overwritten by your trusted edge. Standalone credential,
password-reset, and magic-link handlers never infer trust from request headers;
provide their `rateLimit.key` or `magicLink.settings.key` callback when they run
outside the central policy.

## Standalone handler security boundary

`createSigninHandler`, `createSignupHandler`,
`createPasswordResetRequestHandler`, and
`createPasswordResetConfirmHandler` now require handler-owned CSRF and
rate-limit callbacks. If an outer application policy always runs first, pass
`externalSecurityBoundary: true` explicitly.

`CookieSessionAdapter` has been removed. It stored sessions in one process and
could not resolve users, so it was neither stateless nor safe for multi-instance
or serverless deployment. Use D1, Drizzle, KV, PostgreSQL, or a custom durable
`SessionAdapter` instead.

## Rate-limit and alert policy ownership

Import `createLoginRateLimiter`, `createRegistrationRateLimiter`, and
`createPasswordResetRateLimiter` from `@goobits/auth/security` instead of
`@goobits/security/rate-limit/auth`. Security owns the generic counter; Auth
owns authentication-specific windows. Managed secure and strict routes now use
the canonical login policy (5/minute and 15/15 minutes).

Prefer `security.rateLimit.windows` for custom policy. The legacy `max` and
`windowMs` pair remains temporarily as a one-window migration bridge.

Auth threshold-rule severities now use the shared Security vocabulary:
`warning` replaces `warn`, and `critical` replaces `error`. Auth event severities
remain `info | warn | error`; only alert-notification policy changed.

## OAuth token encryption rotation

Prefer `oauthTokenEncryption.encryptionKeyringJson` (or an application-owned
`tokenCodec`) over `oauthTokenEncryptionKey`. During migration, keep the old key
in the keyring and set `legacyEncryptionKeyId` to its ID. Legacy ciphertext is
then readable and is lazily resealed with record-bound associated data under the
active key. Remove the old key only after every retained token has been read or
an explicit bulk reseal has completed.

D1 and Drizzle OAuth token tables must enforce a unique `(user_id, provider)`
constraint. Token stores now use atomic upsert rather than delete-then-insert;
add and validate that constraint before deploying this version.
