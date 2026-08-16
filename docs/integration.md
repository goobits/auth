# Integration

This document describes the adapter contract behind `@goobits/auth`. Read
this if you're either:

- Implementing a custom adapter (e.g. Postgres without Drizzle, in-memory for
  tests, a custom KV-backed session store).
- Trying to understand what the prebuilt `drizzleAdapter`, `D1*Adapter`,
  `CookieTokenAdapter`, and `KV*Adapter` are actually doing under the hood.

If you just want to wire the package into a SvelteKit app, start with
[`quickstart.md`](./quickstart.md).

## The mental model

`GoobitsAuth` does not own any storage. You hand it a set of adapter
instances; it composes handlers, runs the security/CSRF/rate-limit pipeline,
and calls into your adapters for the actual reads and writes.

Every adapter is an abstract class in `@goobits/auth/adapters`. To implement
your own, extend the relevant base class and implement its abstract methods.
Custom user adapters should call `assertPublicUserData()` from
`@goobits/auth/adapters/database` before general profile writes; use
`omitSensitiveUserData()` when projecting extension metadata to clients.

```
SessionAdapter           — required (session lifecycle + cookie I/O)
UserAdapter              — optional (needed for OAuth, magic links, passkeys)
PasswordCredentialAdapter — optional (required for password sign-in/sign-up)
OAuthIdentityAdapter     — optional (required when OAuth providers are configured)
TokenAdapter             — optional (stores OAuth access/refresh tokens)
VerificationTokenAdapter — optional (email verification, password reset)
MagicLinkAdapter         — optional (required if magicLink config is set)
WebAuthnAdapter          — optional storage/authentication capability
WebAuthnCredentialCreationAdapter — required if webauthn registration is enabled
```

The `GoobitsAuth` constructor validates which adapters are required for
which features:

- `adapter.session` is always required.
- `adapter.magicLink` is required if you pass a `magicLink` config block.
- `adapter.webauthn` must satisfy `WebAuthnRegistrationAdapter` if you pass a
  `webauthn` config block.
- `adapter.user` and `adapter.oauthIdentity` are required when any OAuth
  provider is configured. Auth does not fall back to anonymous provisioning or
  email-based account matching.

## Adapter contracts

### `SessionAdapter` (required)

```ts
abstract readonly cookieName: string
abstract createSession(userId: string, metadata?: SessionMetadata): Promise<Session>
abstract validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }>
abstract invalidateSession(sessionId: string): Promise<void>
abstract invalidateUserSessions(userId: string): Promise<void>
abstract setSessionCookie(cookies: Cookies, session: Session): void
abstract deleteSessionCookie(cookies: Cookies): void

// Optional non-secret session-management capability
listManagedSessions?(userId: string): Promise<SessionSummary[]>
revokeManagedSession?(userId: string, managementId: string): Promise<void>
```

Behavioral expectations:

- `createSession` returns a 256-bit bearer token but persists only its SHA-256
  verifier. `validateSession` and `invalidateSession` accept the bearer and hash
  it before storage access. Do not add raw-token fallback reads.
- `validateSession` returns `{ session: null, user: null }` for unknown or
  expired session IDs. Storage-backed adapters should follow the package's
  documented failure policy rather than exposing backend errors to callers.
- `validateSession` is allowed to **renew** the session and set
  `session.fresh = true` to signal that the cookie should be re-issued; the
  `GoobitsAuth` hook pipeline checks this and calls `setSessionCookie`.
- `setSessionCookie` is responsible for cookie attributes (`HttpOnly`,
  `Secure`, `SameSite`, path). Don't expect the framework to add them.
- `cookieName` is required and is the single cookie-name source used by the
  framework hook.
- Session listings must expose an independent opaque management ID, never the
  persisted verifier or bearer token. Revocation by management ID must also be
  constrained by the authenticated owner.
- `SessionMetadata` is a deliberately bounded contract. Reject unknown fields
  instead of persisting arbitrary request or extension data.

### `UserAdapter` (effectively required for OAuth/magic-link/passkey flows)

```ts
abstract createUser(profile: OAuthProfile, metadata?: Record<string, unknown>): Promise<User>
abstract getUserById(id: string): Promise<User | null>
abstract getUserByEmail(email: string): Promise<User | null>
abstract updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User>
abstract deleteUser(id: string): Promise<void>

// optional
getUserByIdentifier?(identifier: string, field?: string): Promise<User | null>
```

Behavioral expectations:

- Every `getUser*` and `create/update` method returns **sanitized** users —
  no password hashes and no internal-only fields. Password fields supplied to
  profile creation or updates must not cross this boundary.

OAuth ownership is intentionally absent from this profile-only capability.
Provider subjects and mutable profile/email data have different lifecycles.

### `OAuthIdentityAdapter` (required for OAuth providers)

```ts
getIdentity(provider: string, subject: string): Promise<OAuthIdentity | null>
listIdentities(userId: string): Promise<OAuthIdentity[]>
linkIdentity(identity: OAuthIdentity): Promise<void>
unlinkIdentity(userId: string, provider: string): Promise<void>
```

Enforce both unique `(provider, provider_account_id)` ownership and at most one
identity per `(user_id, provider)`. `linkIdentity` must be idempotent only when
the existing owner and subject are identical; it must never reassign an
identity. Existing D1/Drizzle schemas keep the `providerAccountId` column
mapping while this protocol port uses the standards term `subject`.

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
calls using the user's OAuth tokens. The Drizzle bundle accepts a rotation-ready
`oauthTokenEncryption` keyring or custom codec, binds ciphertext to the user and
provider, and lazily reseals retired keys. Enforce a unique `(user_id, provider)`
constraint for atomic storage. If you roll your own, preserve the same controls —
these are bearer credentials.

### `VerificationTokenAdapter`, `MagicLinkAdapter`, `WebAuthnAdapter`

These follow the same shape — abstract base in `adapters/<feature>/base.ts`,
prebuilt Drizzle and D1 implementations alongside. Read the base file; the
JSDoc on each abstract method describes the expected behavior.

Database-backed WebAuthn adapters intentionally expose storage and
authentication operations without pretending a generic database port owns
application account policy. Passkey registration additionally requires:

```ts
interface WebAuthnCredentialCreationAdapter {
  createCredentialWithinLimit(
    input: CreateWebAuthnCredentialWithinLimitInput
  ): Promise<'created' | 'duplicate' | 'limit-reached' | 'owner-unavailable'>
}
```

Implement that capability with one transaction or owner-scoped lock covering
account eligibility, the credential count, and the insert. A list-then-insert
sequence is not atomic. `MemoryWebAuthnAdapter` supplies the full contract for
single-process development. `PgWebAuthnAdapter` calls the bundled
owner-row-locked registration routine; apply its schema/migration before
registration is enabled. Other durable adapters must be composed with the host
application's transaction boundary.

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

Token issuance has a matching atomicity requirement.
`VerificationTokenAdapter.replaceForUserAndType` must replace the active token
for one `(userId, type)` in a single transaction or upsert. Back the pair with
a unique constraint. A delete-then-insert implementation can invalidate a
working recovery or MFA challenge when the insert fails and is unsupported.

## Prebuilt adapters

| Export                                 | Storage                   | Notes                                                                                                                                           |
| -------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzleAdapter(db, options)`          | Any Drizzle-supported SQL | One-stop bundle with separate public-user and password-credential capabilities. Reads `options.schema` or `options.tables` to bind table names. |
| `D1SessionAdapter`, `D1UserAdapter`, … | Cloudflare D1             | Hand-rolled SQL; takes a `D1Database` instance and table names.                                                                                 |
| `KVSessionAdapter`, `KVTokenAdapter`   | Cloudflare KV             | For environments where D1 isn't available.                                                                                                      |
| `CookieTokenAdapter`                   | Encrypted cookie          | OAuth-token storage only; requires an encryption key. It is not a session adapter.                                                              |
| `createPgAuthAdapters(options)`        | PostgreSQL                | Node-only bundle with verification-token storage; requires an application-owned `mfaSecretCodec`.                                               |

If your storage doesn't fit any of these, extend the base class directly.

The PostgreSQL bundle never stores a plaintext TOTP secret and has no plaintext
fallback. Its required `mfaSecretCodec` must bind ciphertext to the supplied
user ID and use `@goobits/security/crypto` AES-GCM primitives, a managed KMS, or
an equivalent authenticated-encryption service. Keep key identifiers in the
ciphertext envelope so old keys can decrypt during controlled rotation.

## Custom app adapters

Apps with an existing user table can consume the same contract by wrapping
their storage behind the adapter classes. A typical integration:

1. Reuses the app database tables for users, sessions, identities, and tokens.
2. Implements custom `UserAdapter` and `SessionAdapter` subclasses when the app
   has extra columns or a different user shape.
3. Hands the bundle to `new GoobitsAuth({ adapter: {...} })`.

Keep the adapter boundary small: translate between app storage and package
types at the edge, then keep auth flows package-owned.

## Things the package does not do

- It does not own your schema. Drizzle and D1 adapters expect tables to
  exist; see `schema.md`.
- It does not own redirect routing beyond `urls.login` /
  `urls.afterLogin` / `urls.afterLogout`. If your app needs a custom
  post-login redirect dance, return a safe path from `hooks.onAuthentication`
  or handle it in your route
  handlers.
- It does not own email delivery for magic links. You pass a
  `magicLink.send.email` callback; the package builds the link/OTP and
  hands them to you.
- It does not own brand or UI. The `@goobits/auth/ui` exports are minimal
  primitives; consuming sites typically wrap them with their own login pages.
