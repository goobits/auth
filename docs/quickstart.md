# Quick Start (SvelteKit)

This is the 5-minute path.

## 1. Create auth instance

```ts
// src/lib/auth.ts
import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { AppleProvider, GoogleProvider } from '@goobits/auth/providers'
import { hasRecentMfaVerification, hasRecentPrimaryAuthentication } from '@goobits/auth/security'
import { db, schema } from '$lib/server/db'
import { auditEmitter } from '$lib/server/security/audit'
import { sharedRateLimitStore } from '$lib/server/security/rate-limit'
import { env } from '$env/dynamic/private'

const adapter = drizzleAdapter(db, {
	schema,
	oauthTokenEncryption: {
		encryptionKeyringJson: env.TOKEN_ENCRYPTION_KEYRING,
		legacyEncryptionKeyId: 'previous'
	}
})

export const auth = new GoobitsAuth({
	adapter,
	providers: {
		google: {
			provider: new GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackUrl: `${env.APP_URL}/auth/callback/google`
			})
		},
		apple: {
			provider: new AppleProvider({
				clientId: env.APPLE_CLIENT_ID,
				teamId: env.APPLE_TEAM_ID,
				keyId: env.APPLE_KEY_ID,
				privateKey: env.APPLE_PRIVATE_KEY,
				callbackUrl: `${env.APP_URL}/auth/callback/apple`
			})
		}
	},
	hooks: {
		onAuthentication: async ({ method, user }) => {
			if (user) return { userId: user.id }
			if (method.kind !== 'oauth' || method.intent !== 'sign-in') return

			// Explicit product policy: create only when the provider email does not
			// collide with an existing local account. Never link by email.
			if (await adapter.user.getUserByEmail(method.profile.email)) {
				return { redirectTo: '/login?error=account_exists' }
			}
			const created = await adapter.user.createUser(method.profile)
			return { userId: created.id }
		}
	},
	oauth: {
		authorizeIdentityChange: ({ session, userId }) =>
			session?.userId === userId &&
			(hasRecentPrimaryAuthentication(session, { maxAgeMs: 5 * 60_000 }) ||
				hasRecentMfaVerification(session, { maxAgeMs: 5 * 60_000 }))
	},
	security: {
		rateLimit: { store: sharedRateLimitStore },
		audit: { emitter: auditEmitter }
	}
})
```

Use one durable rate-limit store across production instances and bridge an
awaited `@goobits/security/audit` logger with `createAuthEventAuditEmitter`.
The secure profile issues CSRF tokens on safe requests, and
`createAuthClient()` echoes them on unsafe same-origin requests automatically.
The onboarding hook above is intentionally application-owned: replace it with
your invite, collision, and profile-completion policy. `session.createdAt` must
come from verified primary authentication, while passkey/MFA step-up records
`session.mfaVerifiedAt`; use the shared assurance helpers instead of trusting
request metadata.

## Runtime Notes

- The main `@goobits/auth` entrypoint is SvelteKit-first. Use low-level
  subpaths such as `@goobits/auth/security`, `@goobits/auth/password`, or
  `@goobits/auth/adapters/pg` for framework-neutral primitives.
- Cloudflare Workers/Pages: WebAuthn handlers are unsupported; password hashing uses a Workers-compatible Argon2id (WASM).
- Node 22+: conditional exports select native Argon2 and the Node WebAuthn handlers.

## 2. Wire SvelteKit hook

```ts
// src/hooks.server.ts
import { auth } from '$lib/auth'

export const handle = auth.handle()
```

## 3. Add catch-all auth route

```ts
// src/routes/auth/[...auth]/+server.ts
import { auth } from '$lib/auth'

export const { GET, POST } = auth.handlers
```

## 4. Protect routes

```ts
// src/routes/admin/+page.server.ts
import { auth } from '$lib/auth'

export async function load(event) {
	await auth.requireAuthRole(event, 'admin')
	return {}
}
```

## 5. Optional: wrapper handlers

```ts
import { auth } from '$lib/auth'

export const POST = async (event) => {
	console.info('auth POST', event.url.pathname)
	return auth.handlers.POST(event)
}
```

## Notes

- `auth.handle()` populates `event.locals.user`, `event.locals.session`, and `event.locals.auth`.
- `auth.handlers` supports canonical sign-in, link, reauthentication, callback,
  identity-management, signout, magic-link, passkey, MFA, and session routes.
- For low-level control, keep using manual handlers/adapters from `@goobits/auth/handlers` and `@goobits/auth/adapters`.
- Continue with [`public-api.md`](public-api.md) for the complete exported surface
  and [`security-contract.md`](security-contract.md) before production rollout.
