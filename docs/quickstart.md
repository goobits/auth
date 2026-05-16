# Quick Start (SvelteKit)

This is the 5-minute path.

## 1. Create auth instance

```ts
// src/lib/auth.ts
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

## Runtime Notes

- Cloudflare Workers/Pages: avoid enabling WebAuthn/passkeys initially; password hashing uses a Workers-compatible Argon2id (WASM).
- Node runtime: uses a Node-optimized build via conditional exports.

## 2. Wire SvelteKit hook

```ts
// src/hooks.server.ts
import { auth } from "$lib/auth";

export const handle = auth.handle();
```

## 3. Add catch-all auth route

```ts
// src/routes/auth/[...auth]/+server.ts
import { auth } from "$lib/auth";

export const { GET, POST } = auth.handlers;
```

## 4. Protect routes

```ts
// src/routes/admin/+page.server.ts
import { auth } from "$lib/auth";

export async function load(event) {
  await auth.requireRole(event, "admin");
  return {};
}
```

## 5. Optional: wrapper handlers

```ts
import { auth } from "$lib/auth";

export const POST = async (event) => {
  console.info("auth POST", event.url.pathname);
  return auth.handlers.POST(event);
};
```

## Notes

- `auth.handle()` populates `event.locals.user`, `event.locals.session`, and `event.locals.auth`.
- `auth.handlers` supports `/auth/signin/:provider`, `/auth/callback/:provider`, `/auth/signout`, and feature routes for magic links, passkeys, and sessions.
- For low-level control, keep using manual handlers/adapters from `@goobits/auth/handlers` and `@goobits/auth/adapters`.
