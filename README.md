# @goobits/auth

Pluggable authentication for SvelteKit with a class-first API.

```bash
pnpm add @goobits/auth
```

## 5-Minute Setup

```ts
// src/lib/auth.ts
import { GoobitsAuth } from "@goobits/auth";
import { drizzleAdapter } from "@goobits/auth/adapters/drizzle";
import { GoogleProvider } from "@goobits/auth/providers";
import { db, schema } from "$lib/server/db";
import { env } from "$env/dynamic/private";

export const auth = new GoobitsAuth({
  profile: "secure",
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

## Guard Helpers

- `await auth.requireUser(event)`
- `await auth.requireRole(event, "admin")`
- `await auth.getSession(event)`

## One-Stop Drizzle Adapter

`drizzleAdapter(db, { schema })` returns a unified bundle.

- Required tables: `users`, `sessions`
- Optional tables: `oauthAccounts`, `oauthTokens`, `verificationTokens`, `magicLinkTokens`, `webauthnCredentials`, `webauthnChallenges`

## Production Guarantees

- `hooks.onLogin` resolves identity only; framework-managed session issuance remains default.
- If no principal is resolved in login flows (`OAuth`, `Magic Link`, `WebAuthn`), auth fails explicitly.
- Session revoke capabilities are mapped to deterministic responses (`501` for unsupported operations).

## Docs

- `docs/quickstart.md`
- `docs/public-api.md`
- `docs/security-contract.md`
- `docs/schema.md`
- `docs/migrations/vnext-breaking.md`
