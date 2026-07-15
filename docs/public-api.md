# Public API (vNext)

Primary API: `new GoobitsAuth(...)`

`@goobits/auth` is SvelteKit-first. The main class, route handlers, cookie
adapters, and UI helpers use SvelteKit request/cookie/build types. Consumers
outside SvelteKit should prefer low-level subpaths such as
`@goobits/auth/security`, `@goobits/auth/password`, `@goobits/auth/mfa`, or
`@goobits/auth/adapters/pg`.

## Stability

The documented exports are stable for the `0.2.x` line. WebAuthn and MFA may
receive additive options as platform behavior evolves.

## Distribution

The package publishes compiled JavaScript and declarations from `dist`.
Conditional exports select native Argon2 and WebAuthn support on Node 22+, while
the default Worker build uses WASM-backed password hashing and explicit
unsupported WebAuthn handlers. `@goobits/auth/node` and
`@goobits/auth/adapters/pg` intentionally have no Worker target.

## Main entrypoint

```ts
import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { GoogleProvider } from '@goobits/auth/providers'
import { db, schema } from '$lib/server/db'
import { sharedRateLimitStore } from '$lib/server/security/rate-limit'
import { env } from '$env/dynamic/private'

export const auth = new GoobitsAuth({
	adapter: drizzleAdapter(db, {
		schema,
		oauthTokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY
	}),
	providers: {
		google: {
			provider: new GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackUrl: `${env.APP_URL}/auth/callback/google`
			})
		}
	},
	security: { rateLimit: { store: sharedRateLimitStore } }
})
```

`secure` is the default profile. It requires CSRF and rate limiting, and a
shared rate-limit store is mandatory in production. Applications that enforce
an equivalent outer request boundary must declare
`csrf: { mode: 'off', externalBoundary: true }` rather than silently disabling
CSRF.

## `GoobitsAuth` surface

- `auth.handle()`
- `auth.handlers` (`GET`, `POST`) for catch-all auth route
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

## SvelteKit wiring

```ts
// src/hooks.server.ts
import { auth } from '$lib/auth'

export const handle = auth.handle()
```

```ts
// src/routes/auth/[...auth]/+server.ts
import { auth } from '$lib/auth'

export const { GET, POST } = auth.handlers
```

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

- required: `session`, `user`
- optional (when tables exist): `oauthToken`, `verificationToken`, `magicLink`, `webauthn`

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

`verifyPassword` may return either a boolean or
`{ valid, needsRehash }`. When `needsRehash` is true, the provider replaces the
stored hash through the configured user adapter after successful verification.
Use this for read-only legacy hash support while all new hashes continue through
the provider's current hasher.

All credential paths enforce a non-configurable 1024-character absolute limit
before calling built-in or custom password work. Applications may impose a
lower product-specific limit, but not a higher one.

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

MFA login challenges reuse `VerificationTokenAdapter`. Adapters should preserve
the optional token metadata when remember-me or session context must survive
between the password and second-factor requests.

## Security primitives

Use `@goobits/auth/security` when an app owns its route policy or persistence
layer but should share auth primitives:

```ts
import {
	createAuthApiKey,
	createBasicAuthResponse,
	createSignedSessionToken,
	hashAuthApiKey,
	parseBasicAuthHeader,
	validateCsrfRequest,
	verifyBasicAuthHeader,
	verifyAuthApiKey,
	verifySignedSessionToken
} from '@goobits/auth/security'
```

- Basic auth parsing and verification with caller-provided password hash checks.
- Standard Basic-auth challenge responses.
- Signed, expiring session-token creation and verification.
- CSRF issuance/validation, API-key helpers, role/ownership guards, and timing-safe comparisons. Generic rate limiting lives in `@goobits/security/rate-limit`.

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
