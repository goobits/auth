# Public API (vNext)

Primary API: `new GoobitsAuth(...)`

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
- `auth.requireRole(event, role | role[])`
- `auth.adapter` (raw adapters for advanced/manual usage)

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
