# Public API (0.3.x)

Primary API: `new GoobitsAuth(...)`

`@goobits/auth` is SvelteKit-first. The main class, route handlers, cookie
adapters, and UI helpers use SvelteKit request/cookie/build types. Consumers
outside SvelteKit should prefer low-level subpaths such as
`@goobits/auth/security`, `@goobits/auth/password`, `@goobits/auth/mfa`, or
`@goobits/auth/adapters/pg`. Verification-token helpers live at
`@goobits/auth/verification`.

## Stability

The documented exports are stable for the `0.3.x` line. WebAuthn and MFA may
receive additive options as platform behavior evolves.

## Main Entrypoint

`GoobitsAuth` is the primary class exported from `@goobits/auth`. The complete
instance, provider, hook, and catch-all route setup lives in
[`quickstart.md`](quickstart.md); this file documents the resulting public
surface without maintaining a second setup recipe.

`secure` is the default profile. It requires CSRF, production rate limiting,
and an awaited audit emitter. An equivalent outer request boundary must be
declared through the executable
`validateExternalSecurityBoundary` callback; a boolean opt-out is not accepted.

## `GoobitsAuth` surface

- `auth.handle()`
- `auth.handlers` (`GET`, `POST`) for catch-all auth route
- `auth.routes` for individually mounted named route factories
- `auth.createHandlers({ basePath? })` for custom mount paths
- `auth.getSession(event)`
- `auth.requireUser(event)`
- `auth.requireAuthRole(event, authRole | authRole[])`
- `auth.emitSecurityEvent(event)` for custom auth-route outcomes
- `auth.adapter` (raw adapters for advanced/manual usage)

`requireAuthRole()` is for website/session route gates. It is not a product
permission check for Spaces, Zones, Goobits, agents, or wormholes.

Security alert webhooks are configured through `security.alerts.webhook.url`.
`SECURITY_WEBHOOK_URL` is read from `process.env` when no explicit URL is
provided. Use `security.alerts.onAlert` for custom signing, cooldown, or fan-out
behavior.

## SvelteKit Wiring

Use the hook and catch-all route shown in [`quickstart.md`](quickstart.md).
Custom mount paths can instead use `auth.createHandlers({ basePath })` or the
named factories under `auth.routes`.

## Wrappable handlers

```ts
import { auth } from '$lib/auth'

export const GET = async (event) => {
	console.info('auth request', event.url.pathname)
	return auth.handlers.GET(event)
}
```

## Adapter bundle

`drizzleAdapter(db, { schema })` returns a single bundle with:

- required: `session`, `user`, `passwordCredential`
- optional (when tables exist): `oauthToken`, `verificationToken`, `magicLink`, `webauthn`

When `oauthTokens` exists, configure `oauthTokenEncryption` with either a
rotation-ready `encryptionKeyringJson` or an application `tokenCodec`. The table
must enforce one row per `(userId, provider)` so stores and lazy key rotation use
an atomic upsert.

Session adapters return bearer tokens only from `createSession()` and persist
only their verifiers. Import `createSessionToken` and `hashSessionToken` from
`@goobits/auth/adapters/session` when implementing a custom store. Never expose
the persisted verifier through listing APIs; implement the optional managed
session capability with a separate opaque management ID.

### Required schema tables

- `users`
- `sessions`

### Optional schema tables

- `oauthAccounts`
- `oauthTokens`
- `verificationTokens`
- `magicLinkTokens`
- `webauthnCredentials`
- `webauthnChallenges`

## Credentials Provider

```ts
import { CredentialsProvider } from '@goobits/auth/providers'

const credentials = new CredentialsProvider({
	identifierField: 'nickname',
	allowBoth: true,
	normalizeIdentifier: (value) => value.trim().toLowerCase()
})
```

Handler options support custom form field names and metadata:

- `createSigninHandler({ fields: { identifier, password, remember }, identifierField })`
- `createSignupHandler({ fields: { email, password, name }, metadataFields, getSignupMetadata })`

Standalone signin, signup, and password-reset handlers fail at construction
unless both CSRF and rate-limit callbacks are configured. When an application
already enforces equivalent checks before the handler, acknowledge that
boundary explicitly with `validateExternalSecurityBoundary: verifyOuterPolicy`;
omission is never a silent opt-out. The value is an async request validator
callback, not a boolean.

Authentication limiter presets are exported from `@goobits/auth/security`:

```ts
import {
	createLoginRateLimiter,
	createPasswordResetRateLimiter,
	createRegistrationRateLimiter
} from '@goobits/auth/security'
```

They share the same package-owned multi-window policy as managed Auth routes and
delegate storage/counter mechanics to `@goobits/security/rate-limit`.

`verifyPassword` may return either a boolean or
`{ valid, needsRehash }`. When `needsRehash` is true, the provider replaces the
stored hash through the configured `PasswordCredentialAdapter` after successful
verification.
Use this for read-only legacy hash support while all new hashes continue through
the provider's current hasher.

General `UserAdapter` methods never return or accept password hashes. Credential
handlers receive the bundle's `passwordCredential` capability explicitly, so a
profile-only code path cannot accidentally acquire secret-bearing records.

Password-reset confirmation requires an application-owned
`completePasswordReset({ tokenHash, passwordHash })` callback. That callback
must atomically consume the reset token, update the password hash, and invalidate
the user's existing sessions before it reports success.

All credential paths enforce a non-configurable 1024-character absolute limit
before calling built-in or custom password work. Applications may impose a
lower product-specific limit, but not a higher one.

Unknown and passwordless identifiers run one dummy-hash verification by default.
Provide a precomputed `dummyPasswordHash` when cold-start latency matters, and
always retain route-level rate limiting.

Credential MFA is a two-step flow:

- pass `mfa` to `createSigninHandler`; enabled or policy-required users receive
  `twoFactorRequired` and no session
- complete the short-lived, single-use challenge with
  `createMfaLoginVerifyHandler`; only that handler creates the session

Factor enrollment and removal require an application-owned step-up callback:

```ts
const mfa = {
	authorizeSecurityChange: async ({ request, userId }) => {
		const form = await request.formData()
		return verifyCurrentPassword(userId, String(form.get('current_password') ?? ''))
	}
}
```

The callback receives an independent request clone and must fail closed unless
it verifies a fresh credential for the authenticated `userId`. Pending TOTP
secret and backup-code storage is atomic, an enabled factor cannot be silently
replaced, and backup codes are accepted only when their atomic single-use
consume succeeds.

Passkey registration uses the same callback with the
`webauthn.register` action. Registration challenges are bound to the
authenticated principal, and verification rejects a challenge completed under
a different or missing principal. Applications can satisfy the callback from a
recent-authentication session marker or another fresh credential check.

Sessions created by the MFA verification handler receive
`Session.mfaVerifiedAt`. Persistent session adapters must store and restore this
optional field when the consuming application uses session assurance for
privileged authorization. It must not be populated from request-controlled
metadata.

Applications that verify a current credential outside a managed handler can
use `rotateSessionAssurance()` from `@goobits/auth/handlers`. The helper rotates
the session with compensating cleanup, binds the update to the same principal,
preserves trusted session context, and refreshes exactly one of primary or MFA
assurance.

MFA login challenges reuse `VerificationTokenAdapter`. Adapters should preserve
the optional token metadata when remember-me or session context must survive
between the password and second-factor requests.

Magic-link token URLs use a scanner-safe confirmation interstitial by default.
The GET request does not consume the token; a short-lived, HttpOnly
confirmation cookie and deliberate POST are required. Set
`settings.requireUserConfirmation: false` only when an application-owned page
already provides an equivalent same-origin confirmation boundary. The raw token
is supplied only to the configured delivery callback and is never returned in
an HTTP response.

## Security primitives

Use `@goobits/auth/security` for auth-specific policy, authorization, audit,
alerts, and rate-limit presets:

```ts
import {
	createLoginRateLimiter,
	requireAuthenticated,
	requireOwnership
} from '@goobits/auth/security'
```

- Auth event auditing, role/ownership guards, policy composition, and
  authentication-specific limits.
- Import SvelteKit CSRF integration directly from
  `@goobits/security/csrf/sveltekit`. Custom session adapters use
  `createSessionToken` and `hashSessionToken` from
  `@goobits/auth/adapters/session`.

Generic primitives are intentionally imported from their Security owners:

```ts
import {
	createApiKey,
	parseApiKeyHeader,
	parseBasicAuthHeader,
	verifyApiKey,
	verifyBasicAuthHeader
} from '@goobits/security/http-credentials'
import { constantTimeEqual } from '@goobits/security/crypto'
import { redactSensitive } from '@goobits/security/redaction'
```

## Typing App locals

```ts
// src/app.d.ts
import type { Session, User } from '@goobits/auth/types'

type AppUser = User & {
	organizationId: string
}

declare global {
	namespace App {
		interface Locals {
			user?: AppUser | null
			session?: Session | null
			auth?: { user: AppUser; session: Session } | null
		}
	}
}
```
