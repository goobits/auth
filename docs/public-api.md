# Public API

Canonical API: `new GoobitsAuth(...)`.

The lower-level `createAuth(...)` core is internal. Use `GoobitsAuth` for app wiring and the intentional subpaths below for advanced adapter, handler, client, and security work.

## Subpath status

### Stable

- `@goobits/auth`
- `@goobits/auth/adapters`
- `@goobits/auth/adapters/database`
- `@goobits/auth/adapters/drizzle`
- `@goobits/auth/adapters/magic-link`
- `@goobits/auth/adapters/memory`
- `@goobits/auth/adapters/oauth-token`
- `@goobits/auth/adapters/pg`
- `@goobits/auth/adapters/session`
- `@goobits/auth/adapters/verification-token`
- `@goobits/auth/adapters/webauthn`
- `@goobits/auth/client`
- `@goobits/auth/errors`
- `@goobits/auth/handlers`
- `@goobits/auth/mfa`
- `@goobits/auth/node`
- `@goobits/auth/providers`
- `@goobits/auth/security`
- `@goobits/auth/testing`
- `@goobits/auth/types`
- `@goobits/auth/ui`
- `@goobits/auth/utils`

### Internal implementation modules

- `src/createAuth.ts` is the shared internal engine behind `GoobitsAuth`.
- OAuth callback cookie helpers, token encryption helpers, verification-token workflows, and low-level sanitizer/redaction helpers are implementation details. Import them relatively inside the package instead of exporting them through `@goobits/auth/utils`.
- Security policy wrapping, auth event creation, and webhook alert delivery are internal wiring for `createAuth`.

## Main entrypoint

```ts
import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { GoogleProvider } from '@goobits/auth/providers'
import { db, schema } from '$lib/server/db'
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
	}
})
```

## `GoobitsAuth` surface

- `auth.handle()`
- `auth.handlers` (`GET`, `POST`) for catch-all auth route
- `auth.createHandlers({ basePath? })` for custom mount paths
- `auth.getSession(event)`
- `auth.requireUser(event)`
- `auth.requireRole(event, role | role[])`
- `auth.adapter` (raw adapters for advanced/manual usage)

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

## Node and simple runtime adapters

Plain Node HTTP hosts can create auth events and forward handler responses without owning a SvelteKit app:

```ts
import { createNodeAuthEvent, sendFetchResponse } from '@goobits/auth/node'
```

Runtime adapter bundles:

- `createMemoryAuthAdapters({ cookieName, secureCookies })` from `@goobits/auth/adapters/memory` for dev/demo use.
- `createPgAuthAdapters({ db, cookieName, secureCookies })` from `@goobits/auth/adapters/pg` for `node-postgres`-compatible pools.
- `pgAuthSchemaSql` from `@goobits/auth/adapters/pg` for the default Postgres schema.

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

## Typing App locals

```ts
// src/app.d.ts
import type { Session, User } from '@goobits/auth/types'

declare global {
	namespace App {
		interface Locals {
			user?: User | null
			session?: Session | null
			auth?: { user: User; session: Session } | null
		}
	}
}
```
