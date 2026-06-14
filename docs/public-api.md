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

## Main entrypoint

```ts
import { GoobitsAuth } from "@goobits/auth";
import { drizzleAdapter } from "@goobits/auth/adapters/drizzle";
import { GoogleProvider } from "@goobits/auth/providers";
import { db, schema } from "$lib/server/db";
import { env } from "$env/dynamic/private";

export const auth = new GoobitsAuth({
  adapter: drizzleAdapter(db, {
    schema,
    oauthTokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
  }),
  providers: {
    google: {
      provider: new GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackUrl: `${env.APP_URL}/auth/callback/google`,
      }),
    },
  },
});
```

## `GoobitsAuth` surface

- `auth.handle()`
- `auth.handlers` (`GET`, `POST`) for catch-all auth route
- `auth.createHandlers({ basePath? })` for custom mount paths
- `auth.getSession(event)`
- `auth.requireUser(event)`
- `auth.requireAuthRole(event, authRole | authRole[])`
- `auth.adapter` (raw adapters for advanced/manual usage)

`requireAuthRole()` is for website/session route gates. It is not a product
permission check for Spaces, Zones, Goobits, agents, or wormholes.

Security alert webhooks are configured through
`security.alerts.webhook.{url,secret,cooldownMs,maxPerHour,timeoutMs}`. The
legacy `SECURITY_WEBHOOK_URL` and `SECURITY_WEBHOOK_SECRET` process env fallback
is kept for compatibility when explicit webhook fields are not provided.

## SvelteKit wiring

```ts
// src/hooks.server.ts
import { auth } from "$lib/auth";

export const handle = auth.handle();
```

```ts
// src/routes/auth/[...auth]/+server.ts
import { auth } from "$lib/auth";

export const { GET, POST } = auth.handlers;
```

## Wrappable handlers

```ts
import { auth } from "$lib/auth";

export const GET = async (event) => {
  console.info("auth request", event.url.pathname);
  return auth.handlers.GET(event);
};
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
import { CredentialsProvider } from "@goobits/auth/providers";

const credentials = new CredentialsProvider({
  identifierField: "nickname",
  allowBoth: true,
  normalizeIdentifier: (value) => value.trim().toLowerCase(),
});
```

Handler options support custom form field names and metadata:

- `createSigninHandler({ fields: { identifier, password, remember }, identifierField })`
- `createSignupHandler({ fields: { email, password, name }, metadataFields, getSignupMetadata })`

## Security primitives

Use `@goobits/auth/security` when an app owns its route policy or persistence
layer but should share auth primitives:

```ts
import {
  createBasicAuthResponse,
  createSignedSessionToken,
  parseBasicAuthHeader,
  validateCsrfRequest,
  verifyBasicAuthHeader,
  verifySignedSessionToken,
} from "@goobits/auth/security";
```

- Basic auth parsing and verification with caller-provided password hash checks.
- Standard Basic-auth challenge responses.
- Signed, expiring session-token creation and verification.
- CSRF issuance/validation, rate-limit helpers, API-key helpers, role/ownership guards, and timing-safe comparisons.

## Typing App locals

```ts
// src/app.d.ts
import type { Session, User } from "@goobits/auth/types";

declare global {
  namespace App {
    interface Locals {
      user?: User | null;
      session?: Session | null;
      auth?: { user: User; session: Session } | null;
    }
  }
}
```
