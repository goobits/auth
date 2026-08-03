# @goobits/auth

Pluggable authentication for SvelteKit with a class-first API and durable
adapters for sessions, users, credentials, OAuth identities and tokens, MFA,
and WebAuthn.

## Start Here

```bash
pnpm add @goobits/auth
```

- [`docs/quickstart.md`](docs/quickstart.md) owns the complete SvelteKit setup.
- [`docs/public-api.md`](docs/public-api.md) is the exported API reference.
- [`docs/integration.md`](docs/integration.md) covers custom storage adapters.
- [`docs/security-contract.md`](docs/security-contract.md) defines application
  and library security responsibilities.

A normal SvelteKit integration creates one `GoobitsAuth` instance, wires
`auth.handle()` into `hooks.server.ts`, and mounts `auth.handlers` at
`src/routes/auth/[...auth]/+server.ts`. Use `drizzleAdapter(db, { schema })` for
Drizzle or provide the documented adapter capabilities for another store.

## Entrypoints

The main `@goobits/auth` entrypoint, route handlers, cookie adapters, and UI
helpers are SvelteKit-first. Framework-neutral primitives are available through
focused subpaths:

- `@goobits/auth/security`
- `@goobits/auth/verification`
- `@goobits/auth/password`
- `@goobits/auth/mfa`
- `@goobits/auth/adapters/pg`
- `@goobits/auth/testing`

Generic HTTP credentials, CSRF, cryptography, logging, redaction, and rate-limit
counters remain owned by their `@goobits/security/*` entrypoints.

## Stability And Distribution

Documented exports are stable for the `0.6.x` line. WebAuthn and MFA may receive
additive options as browser and authenticator behavior evolves.

- First-party TypeScript workspaces consume checked-out `src/` entrypoints so
  application checks cannot use stale generated output.
- Registry installations consume compiled JavaScript and declarations from
  `dist`; raw TypeScript and release tooling are excluded.
- `pnpm run build` rebuilds the compiled package when a workspace needs `dist`.

## Runtime Targets

- Cloudflare Workers and Pages use the Worker build and WASM-backed password
  hashing. WebAuthn handlers return `501` and must not be enabled there.
- Node 22+ selects native Argon2 and Node WebAuthn support. `@goobits/auth/node`
  and `@goobits/auth/adapters/pg` are Node-only.

## Core Contract

- `GoobitsAuth` owns the SvelteKit handle, managed handlers, named route
  factories, session lookup, route-role guards, and security-event pipeline.
- The `secure` profile requires request-origin verification, shared production
  rate limiting, and an awaited audit emitter. Signed CSRF tokens additionally
  require `security.csrf.secret`; secure deployments may explicitly disable the
  token layer only while origin verification remains required. `strict`
  requires both boundaries.
- `requireAuthRole()` gates website/session roles; product permissions remain an
  application concern.
- `drizzleAdapter()` returns the required session, user, and password-credential
  capabilities plus optional OAuth identity/token, magic-link, MFA, and
  WebAuthn storage capabilities when their tables are configured. Enabling
  passkey registration additionally requires an application-owned atomic
  `createCredentialWithinLimit()` capability.
- Password hashes are available only through `PasswordCredentialAdapter`, never
  through general user-profile methods.
- Password-reset completion and token consumption require application-owned
  atomic operations; unsafe find-then-delete compatibility paths are not kept.
- Session stores persist verifier hashes rather than bearer cookie values, and
  managed-session APIs use separate opaque identifiers.
- OAuth token storage requires a rotation-ready keyring or application-owned
  codec and a unique `(userId, provider)` constraint.
- OAuth ownership uses a provider's stable subject through the dedicated
  `OAuthIdentityAdapter`; mutable email claims never link accounts implicitly.
- OAuth sign-in, provider linking, reauthentication, and unlinking are separate
  flows. Identity changes require application-owned fresh authorization.
- Applications must refuse an unlink that would remove the account's last
  usable sign-in method.
- `credentialMutations` lets applications put assurance, cross-store recovery
  checks, credential persistence, session revocation, and audit state behind
  one serialized transaction boundary.

See the public API and migration guide for the complete capability contracts.

## Production Expectations

- Use one durable rate-limit store across production instances.
- Bridge Auth events into an awaited `@goobits/security/audit` logger with
  `createAuthEventAuditEmitter()`.
- Configure secure cookies, trusted proxy headers, alert delivery, encryption
  keys, and required database migrations before deployment.
- Require fresh application authorization for MFA, passkey, and OAuth identity
  changes.
- Offer conditional passkey autofill only after
  `supportsConditionalPasskeys()` confirms browser support.
- Rotate a current session through `rotateSessionAssurance()` after a trusted
  primary- or second-factor verification instead of rewriting session metadata
  in application code.
- Keep route-level product authorization, TLS, headers, secrets, and key
  rotation in the host application or edge.

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md) — SvelteKit setup.
- [`docs/public-api.md`](docs/public-api.md) — exported API and capability
  reference.
- [`docs/integration.md`](docs/integration.md) — custom adapter contract.
- [`docs/security-contract.md`](docs/security-contract.md) — profiles, defaults,
  and production responsibilities.
- [`docs/schema.md`](docs/schema.md) — schema requirements.
- [`docs/testing.md`](docs/testing.md) — test helpers and expectations.
- [`docs/migrations/0.6-breaking.md`](docs/migrations/0.6-breaking.md) —
  session-bound CSRF, request-origin, and secret-safe provider migration.
- [`docs/migrations/0.5-breaking.md`](docs/migrations/0.5-breaking.md) — atomic
  passkey-registration adapter migration from 0.4.
- [`docs/migrations/0.4-breaking.md`](docs/migrations/0.4-breaking.md) — OAuth
  identity and authentication-lifecycle migration from 0.3.
- [`docs/migrations/0.3-breaking.md`](docs/migrations/0.3-breaking.md) — earlier
  migration from pre-0.3 integrations.
- [`examples/sveltekit-quickstart/`](examples/sveltekit-quickstart/) — minimal
  application wiring.
