# @goobits/auth

Pluggable authentication for SvelteKit with a class-first API.

## TL;DR

- Drop `GoobitsAuth` into `src/lib/auth.ts` and wire `auth.handle()` into `hooks.server.ts`.
- Attach route handlers at `src/routes/auth/[...auth]/+server.ts` with `auth.handlers`.
- Use `drizzleAdapter(db, { schema })` for Drizzle ORM; bring your own adapter for other storage.
- Lower-level subpaths (`/security`, `/password`, `/mfa`, `/adapters/pg`) work outside SvelteKit.

## Entrypoints

`@goobits/auth` is SvelteKit-first. The main `GoobitsAuth` export, route
handlers, cookie adapters, and UI helpers expect SvelteKit request/cookie
types or a SvelteKit build pipeline.

Lower-level subpaths are still useful outside a full SvelteKit app when you
want the primitives directly:

- `@goobits/auth/security`
- `@goobits/auth/verification`
- `@goobits/auth/password`
- `@goobits/auth/mfa`
- `@goobits/auth/adapters/pg`
- `@goobits/auth/testing`

## Stability

The documented exports are treated as stable for the `0.3.x` line. WebAuthn
and MFA APIs are production-oriented but may receive additive options as
browser and authenticator behavior evolves.

## Usage

`@goobits/auth` supports two deliberate distribution modes:

- First-party TypeScript workspaces consume the checked-out `src/` entrypoints
  directly, so application checks and builds cannot use stale generated output.
- Registry installations consume compiled Node/Worker JavaScript and declarations
  from `dist/`; raw TypeScript is excluded from the published artifact.

Use `pnpm add @goobits/auth` for a registry install. Workspace consumers should
pin the package checkout and declare `@goobits/auth` as a workspace dependency;
building Auth is required only when testing or publishing its compiled package.

## 5-Minute Setup

```ts
// src/lib/auth.ts
import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { GoogleProvider } from '@goobits/auth/providers'
import { db, schema } from '$lib/server/db'
import { sharedRateLimitStore } from '$lib/server/security/rate-limit'
import { env } from '$env/dynamic/private'

export const auth = new GoobitsAuth({
	profile: 'secure',
	adapter: drizzleAdapter(db, {
		schema,
		oauthTokenEncryption: {
			encryptionKeyringJson: env.TOKEN_ENCRYPTION_KEYRING,
			legacyEncryptionKeyId: 'previous'
		}
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
	security: {
		rateLimit: { store: sharedRateLimitStore },
		audit: { emitter: auditEmitter }
	}
})
```

The `secure` profile requires CSRF and rate limiting. Production deployments
must provide a shared rate-limit store and an awaited audit emitter. Build the
emitter with `createAuthEventAuditEmitter` to bridge a
`@goobits/security/audit` logger. If an application-wide origin guard
already protects every auth route, declare that boundary explicitly with
`csrf: { mode: 'off', validateExternalSecurityBoundary: verifyOrigin }`, where
the callback validates every request at runtime. The Auth client echoes
same-origin CSRF cookies through `@goobits/security/csrf-client`.

## Runtime Targets

- Cloudflare Workers / Pages:
  - Default exports use the Worker build and WASM-backed password hashing.
  - WebAuthn handlers return `501`; do not enable WebAuthn on this target.
- Node runtime:
  - Node 22+ selects the Node build and native Argon2 automatically.
  - `@goobits/auth/node` and `@goobits/auth/adapters/pg` are Node-only.

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

## Guard Helpers

- `await auth.requireUser(event)`
- `await auth.requireAuthRole(event, "admin")`
- `await auth.getSession(event)`
- `auth.routes` for individually mounted named route factories

`requireAuthRole()` checks website/session route roles only. Product
permissions for Spaces, Zones, Goobits, agents, and wormholes should be checked
through the product access system.

## Security Primitives

`@goobits/auth/security` exports auth-specific policy, authorization, audit,
alerting, and authentication rate-limit presets:

```ts
import {
	createLoginRateLimiter,
	requireAuthenticated,
	requireOwnership
} from '@goobits/auth/security'
```

- Auth event auditing, authorization guards, authentication policy, and alert
  composition.
- Session bearer generation and hashing live at
  `@goobits/auth/adapters/session`; generic CSRF primitives live at
  `@goobits/security/csrf` and `@goobits/security/csrf/sveltekit`.

Generic HTTP credentials, redaction, cryptography, logging, and rate-limit
counters belong to `@goobits/security`. Authentication policy presets belong to
Auth so applications and managed routes use the same limits:

```ts
import {
	createLoginRateLimiter,
	createPasswordResetRateLimiter,
	createRegistrationRateLimiter
} from '@goobits/auth/security'
```

Generic mechanisms are not re-exported by Auth:

```ts
import {
	createApiKey,
	parseApiKeyHeader,
	parseBasicAuthHeader,
	verifyApiKey,
	verifyBasicAuthHeader
} from '@goobits/security/http-credentials'
```

## Credentials Provider

```ts
import { CredentialsProvider } from '@goobits/auth/providers'

const credentials = new CredentialsProvider({
	identifierField: 'nickname',
	allowBoth: true,
	normalizeIdentifier: (value) => value.trim().toLowerCase()
})
```

Unknown or passwordless accounts automatically receive a compatible dummy-hash
verification, reducing credential-enumeration timing differences. Keep the
signin route rate-limited; pass `dummyPasswordHash` to avoid first-use hash
generation on latency-sensitive runtimes.

Credential handlers require a `PasswordCredentialAdapter`. Password hashes
are deliberately absent from the general `UserAdapter`; only the dedicated
adapter may read or write them. Prebuilt adapter bundles expose this capability
as `passwordCredential`.

Password-reset confirmation also requires an application-owned
`completePasswordReset({ tokenHash, passwordHash })` transaction. It must
atomically consume the token, update the hash, and invalidate existing sessions.

Sites migrating legacy password formats can compose read-only verification with
`createPasswordMigrationVerifier()` from `@goobits/auth/password`. The current
scheme remains the only writer; a successful legacy check returns
`needsRehash: true` so `CredentialsProvider` upgrades through the dedicated
credential adapter.

## One-Stop Drizzle Adapter

`drizzleAdapter(db, { schema })` returns a unified bundle. The required
`user` and `passwordCredential` capabilities share the configured users table
while keeping public profile access separate from secret-bearing access.

- Required tables: `users`, `sessions`
- Optional tables: `oauthAccounts`, `oauthTokens`, `verificationTokens`, `magicLinkTokens`, `webauthnCredentials`, `webauthnChallenges`

## Production Guarantees

- `hooks.onLogin` resolves identity only; framework-managed session issuance remains default.
- If no principal is resolved in login flows (`OAuth`, `Magic Link`, `WebAuthn`), auth fails explicitly.
- Session revoke capabilities are mapped to deterministic responses (`501` for unsupported operations).

## Security Alerts

Security threshold alerts can be delivered through an explicit webhook config:

```ts
export const auth = new GoobitsAuth({
	adapter,
	security: {
		alerts: {
			enabled: true,
			webhook: {
				url: env.SECURITY_WEBHOOK_URL
			}
		}
	}
})
```

`SECURITY_WEBHOOK_URL` is also read from `process.env` when no explicit
`security.alerts.webhook.url` value is provided. Prefer explicit config in new
apps. Use `security.alerts.onAlert` for custom signing, cooldown, or fan-out
behavior.

Applications that compose public Goobits handler factories into custom routes
should send their final outcomes through the same configured pipeline:

```ts
await auth.emitSecurityEvent({
	name: 'auth.failure',
	severity: 'warn',
	route: event.url.pathname,
	method: event.request.method,
	status: 401
})
```

## Docs

- `docs/quickstart.md`: 5-minute SvelteKit wire-up
- `docs/integration.md`: adapter contract for custom storage backends
- `docs/public-api.md`
- `docs/security-contract.md`
- `docs/schema.md`
- `docs/testing.md`
- `docs/migrations/vnext-breaking.md`
- `examples/sveltekit-quickstart/`: minimal SvelteKit wiring
