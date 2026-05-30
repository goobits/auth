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
- `@goobits/auth/password`
- `@goobits/auth/mfa`
- `@goobits/auth/adapters/pg`
- `@goobits/auth/testing`

## Stability

The documented exports are treated as stable for the `0.2.x` line. WebAuthn
and MFA APIs are production-oriented but may receive additive options as
browser and authenticator behavior evolves.

## Usage

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

## Security Primitives

`@goobits/auth/security` also exports low-level helpers for apps that own
their own route policy or session store:

```ts
import {
  createBasicAuthResponse,
  createSignedSessionToken,
  verifyBasicAuthHeader,
  verifySignedSessionToken,
} from "@goobits/auth/security";
```

- Basic auth parsing and verification with caller-owned password hash checks.
- Signed, expiring session-token claims for custom session stores.
- CSRF, rate-limit, API-key, authorization, and timing-safe comparison helpers.

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

## Security Alerts

Security threshold alerts can be delivered through an explicit webhook config:

```ts
export const auth = new GoobitsAuth({
  adapter,
  security: {
    alerts: {
      enabled: true,
      webhook: {
        url: env.SECURITY_WEBHOOK_URL,
        secret: env.SECURITY_WEBHOOK_SECRET,
      },
    },
  },
});
```

For compatibility, `SECURITY_WEBHOOK_URL` and `SECURITY_WEBHOOK_SECRET` are
also read from `process.env` when no explicit `security.alerts.webhook` value
is provided. Prefer the explicit config in new apps.

## Docs

- `docs/quickstart.md`: 5-minute SvelteKit wire-up
- `docs/integration.md`: adapter contract for custom storage backends
- `docs/public-api.md`
- `docs/security-contract.md`
- `docs/schema.md`
- `docs/testing.md`
- `docs/migrations/vnext-breaking.md`
- `examples/sveltekit-quickstart/`: minimal SvelteKit wiring
