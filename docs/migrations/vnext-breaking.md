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

### Credentials method

Before:

```ts
userAdapter._getUserWithPassword(email)
```

After:

```ts
userAdapter.getUserWithPasswordHash(email)
```

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
idempotent `ALTER TABLE`; KV records need no migration. D1 applications that do
not use session assurance may explicitly set `columns.mfaVerifiedAt` to `null`.

## PostgreSQL MFA encryption

`PgMfaAdapter` and `createPgAuthAdapters` now require an `mfaSecretCodec`.
Encrypt every existing `auth_mfa_factors.secret` value with the selected codec
before deploying this version, and verify the migration from a snapshot. There
is intentionally no plaintext compatibility fallback: unreadable legacy rows
must be migrated or their owners must re-enroll. Bind the user ID as
authenticated context and retain old decryption keys for controlled rotation.
