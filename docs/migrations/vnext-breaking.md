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
