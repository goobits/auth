# @goobits/auth

Pluggable authentication for SvelteKit with a class-first API.

## Install

This package is designed to be used from a SvelteKit build pipeline.

- Workspace/git install (recommended while developing):
  - `pnpm add @goobits/auth --workspace` (monorepo)
  - or install from a git URL (if you publish a repo)
- Registry install:
  - Publish to npm/GitHub Packages first, then `pnpm add @goobits/auth`

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

## Runtime Targets

- Cloudflare Workers / Pages:
  - Use default imports (`@goobits/auth`). Avoid WebAuthn.
- Node runtime:
  - Use Node-optimized entrypoints automatically via `exports` conditions.

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

## Credentials Provider

```ts
import { CredentialsProvider } from "@goobits/auth/providers";

const credentials = new CredentialsProvider({
  identifierField: "nickname",
  allowBoth: true,
  normalizeIdentifier: (value) => value.trim().toLowerCase(),
});
```

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
