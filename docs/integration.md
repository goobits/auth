# Integration

This document describes the adapter contract behind `@goobits/auth`. Read
this if you're either:

- Implementing a custom adapter (e.g. Postgres without Drizzle, in-memory for
  tests, a custom KV-backed session store).
- Trying to understand what the prebuilt `drizzleAdapter`, `D1*Adapter`,
  `Cookie*Adapter`, and `KV*Adapter` are actually doing under the hood.

If you just want to wire the package into a SvelteKit app, start with
[`quickstart.md`](./quickstart.md).

## The mental model

`GoobitsAuth` does not own any storage. You hand it a set of adapter
instances; it composes handlers, runs the security/CSRF/rate-limit pipeline,
and calls into your adapters for the actual reads and writes.

Every adapter is an abstract class in `@goobits/auth/adapters`. To implement
your own, extend the relevant base class and implement its abstract methods.

```
SessionAdapter           — required (session lifecycle + cookie I/O)
UserAdapter              — optional (needed for OAuth, magic links, passkeys)
PasswordCredentialAdapter — optional (required for password sign-in/sign-up)
TokenAdapter             — optional (stores OAuth access/refresh tokens)
VerificationTokenAdapter — optional (email verification, password reset)
MagicLinkAdapter         — optional (required if magicLink config is set)
WebAuthnAdapter          — optional (required if webauthn config is set)
```

The `GoobitsAuth` constructor validates which adapters are required for
which features:

- `adapter.session` is always required.
- `adapter.magicLink` is required if you pass a `magicLink` config block.
- `adapter.webauthn` is required if you pass a `webauthn` config block.
- `adapter.user` is functionally required if you use OAuth providers, magic
  links, or passkeys — the handlers fall back to "anonymous" only when no
  `user` adapter is present, which is rarely useful.

## Adapter contracts

### `SessionAdapter` (required)

```ts
abstract createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session>
abstract validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }>
abstract invalidateSession(sessionId: string): Promise<void>
abstract invalidateUserSessions(userId: string): Promise<void>
abstract listSessions(userId: string): Promise<Session[]>
abstract setSessionCookie(cookies: Cookies, session: Session): void
abstract deleteSessionCookie(cookies: Cookies): void
```

Behavioral expectations:

- `validateSession` returns `{ session: null, user: null }` for unknown or
  expired session IDs. It must not throw.
- `validateSession` is allowed to **renew** the session and set
  `session.fresh = true` to signal that the cookie should be re-issued; the
  `GoobitsAuth` hook pipeline checks this and calls `setSessionCookie`.
- `setSessionCookie` is responsible for cookie attributes (`HttpOnly`,
  `Secure`, `SameSite`, path). Don't expect the framework to add them.
- Optionally expose a `cookieName` property on the adapter instance so the
  framework hook can read the cookie name from there; otherwise it
  defaults to `"session"`.

### `UserAdapter` (effectively required for OAuth/magic-link/passkey flows)

```ts
abstract createUser(profile: OAuthProfile, metadata?: Record<string, unknown>): Promise<User>
abstract getUserById(id: string): Promise<User | null>
abstract getUserByEmail(email: string): Promise<User | null>
abstract getUserByProviderId(provider: string, providerId: string): Promise<User | null>
abstract updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User>
abstract deleteUser(id: string): Promise<void>
abstract linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void>

// optional
getUserByIdentifier?(identifier: string, field?: string): Promise<User | null>
```

Behavioral expectations:

- Every `getUser*` and `create/update` method returns **sanitized** users —
  no password hashes and no internal-only fields. Password fields supplied to
  profile creation or updates must not cross this boundary.
- `linkOAuthAccount` must be idempotent; the OAuth callback path may retry
  it, and the package swallows duplicate-link errors silently.
- `requireVerifiedEmailForLinking` (default `true`) is enforced inside
  `GoobitsAuth`, not in your adapter. If you want to allow OAuth-to-existing
  account linking on unverified emails, set the config flag — don't relax
  your adapter logic.

### `PasswordCredentialAdapter` (required for password credentials)

```ts
findPasswordCredential(identifier: string, field?: string): Promise<{
  user: User
  passwordHash: string | null
} | null>
createUserWithPassword(profile: OAuthProfile, passwordHash: string, metadata?: Record<string, unknown>): Promise<User>
updatePasswordHash(userId: string, passwordHash: string): Promise<User>
```

Only credential authentication and password-mutation flows should receive this
capability. Returned `user` values remain sanitized; the hash is isolated in a
separate field. Implement account creation with a database uniqueness constraint
and an insert that cannot turn a concurrent signup into an update of an existing
account.

### `TokenAdapter` (OAuth tokens)

```ts
storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void>
getTokens(userId: string, provider: string): Promise<OAuthTokens | null>
deleteTokens(userId: string, provider: string): Promise<void>
```

Only needed if you want refresh-token-driven re-auth or downstream API
calls using the user's OAuth tokens. The Drizzle bundle accepts an
`oauthTokenEncryptionKey` and encrypts at rest; if you roll your own,
do the same — these are bearer credentials.

### `VerificationTokenAdapter`, `MagicLinkAdapter`, `WebAuthnAdapter`

These follow the same shape — abstract base in `adapters/<feature>/base.ts`,
prebuilt Drizzle and D1 implementations alongside. Read the base file; the
JSDoc on each abstract method describes the expected behavior.

For schema requirements (magic link tokens, WebAuthn credentials, session
metadata columns), see [`schema.md`](./schema.md).

### Atomic single-use semantics: `consume*` methods

Verification flows (magic link verify, password reset, WebAuthn login) need
to enforce **single-use** on tokens and challenges. Without an atomic
find-and-delete, two concurrent verifies of the same token can both succeed,
creating duplicate sessions.

The three adapter bases — `MagicLinkAdapter`, `VerificationTokenAdapter`,
`WebAuthnAdapter` — require abstract `consume*` methods that the framework calls
during verification:

```ts
MagicLinkAdapter.consumeByTokenHash(tokenHash)
MagicLinkAdapter.consumeByEmailAndOtpHash({ email, otpHash })
VerificationTokenAdapter.consumeByToken({ token, type })
WebAuthnAdapter.consumeChallenge(challengeId)
```

There is no find-then-delete compatibility fallback. Implement each method with
one atomic operation so concurrent verification cannot replay a token or
challenge. For example:

- **SQL backends** (Postgres, SQLite, MySQL via Drizzle, Cloudflare D1):
  use `DELETE ... RETURNING` — the in-tree Drizzle and D1 adapters do this.
- **In-memory backends**: a synchronous `Map.get` + `Map.delete` inside
  the same microtask is effectively atomic in single-threaded JS.
- **Key-value stores**: use a compare-and-delete transaction, Durable Object,
  or equivalent storage primitive. Do not enable the feature on a backend that
  cannot guarantee single-use across instances.

When you override, keep the same return type as the default: the consumed
record on success, `null` if no row matched.

## Prebuilt adapters

| Export                                       | Storage                   | Notes                                                                                                                                           |
| -------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzleAdapter(db, options)`                | Any Drizzle-supported SQL | One-stop bundle with separate public-user and password-credential capabilities. Reads `options.schema` or `options.tables` to bind table names. |
| `D1SessionAdapter`, `D1UserAdapter`, …       | Cloudflare D1             | Hand-rolled SQL; takes a `D1Database` instance and table names.                                                                                 |
| `CookieSessionAdapter`, `CookieTokenAdapter` | Signed cookie             | Stateless; good for edge runtimes without a database. Don't combine with passkey/magic-link features.                                           |
| `KVSessionAdapter`, `KVTokenAdapter`         | Cloudflare KV             | For environments where D1 isn't available.                                                                                                      |
| `createPgAuthAdapters(options)`              | PostgreSQL                | Node-only bundle with verification-token storage; requires an application-owned `mfaSecretCodec`.                                               |

If your storage doesn't fit any of these, extend the base class directly.

The PostgreSQL bundle never stores a plaintext TOTP secret and has no plaintext
fallback. Its required `mfaSecretCodec` must bind ciphertext to the supplied
user ID and use `@goobits/security/crypto` AES-GCM primitives, a managed KMS, or
an equivalent authenticated-encryption service. Keep key identifiers in the
ciphertext envelope so old keys can decrypt during controlled rotation.

## How `@calendar/kit` does it (worked example)

`packages/calendar/kit/src/auth/calendar-adapters.ts` (in this monorepo) is a
real working example of consuming the contract. It:

1. Configures the prebuilt `D1UserAdapter` and `D1SessionAdapter` with the
   calendar table and column names.
2. Explicitly disables `mfaVerifiedAt` persistence because the calendar MVP
   does not yet use session assurance.
3. Reuses a D1-backed rate-limit store for both request limits and durable
   security-alert thresholds.
4. Hands the adapters to `new GoobitsAuth({ adapter: {...} })` in
   `packages/calendar/app/src/server/auth/calendar.ts`.

If you're integrating into an app with an existing user table, that file is
the closest thing to a template.

## Things the package does not do

- It does not own your schema. Drizzle and D1 adapters expect tables to
  exist; see `schema.md`.
- It does not own redirect routing beyond `urls.login` /
  `urls.afterLogin` / `urls.afterLogout`. If your app needs a custom
  post-login redirect dance, do it in `hooks.onLogin` or in your route
  handlers.
- It does not own email delivery for magic links. You pass a
  `magicLink.send.email` callback; the package builds the link/OTP and
  hands them to you.
- It does not own brand or UI. The `@goobits/auth/ui` exports are minimal
  primitives; consuming sites typically wrap them with their own login pages.
