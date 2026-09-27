<h1 align="center">@goobits/auth</h1>

<p align="center"><strong>Pluggable authentication for SvelteKit with explicit storage and security boundaries.</strong></p>
<p align="center">Compose sessions, credentials, OAuth identities, MFA, and WebAuthn through explicit application-owned adapter capabilities.</p>

<p align="center">
  <a href="#why-auth">Why Auth</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#public-surface">Public surface</a> ·
  <a href="#security-boundary">Security</a>
</p>

---

## Why Auth

`@goobits/auth` provides a class-first SvelteKit authentication layer without
claiming ownership of an application's database, product permissions, or
deployment policy. A normal integration creates one `GoobitsAuth` instance,
wires its handle into `hooks.server.ts`, and mounts its managed handlers under an
application route.

Storage is capability-based. Use the included Drizzle, PostgreSQL, or memory
adapters, or implement the documented contracts for sessions, users,
credentials, OAuth identities and tokens, verification tokens, magic links,
MFA, and WebAuthn.

## Quick start

Requires Node.js 22 or a supported Worker runtime.

```bash
pnpm add @goobits/auth
```

The complete supported setup is maintained in [Quick start](docs/quickstart.md).
It covers the application schema, one `GoobitsAuth` instance,
`hooks.server.ts`, and the catch-all auth route. Do not copy isolated snippets
without also applying the security contract.

## Public surface

The main package, managed handlers, cookie behavior, and UI are SvelteKit-first.
Focused subpaths include:

| Import family | Responsibility |
| --- | --- |
| `@goobits/auth/adapters/*` | Database, session, OAuth, token, MFA, WebAuthn, Drizzle, PostgreSQL, and memory capabilities |
| `@goobits/auth/providers` | Authentication provider contracts |
| `@goobits/auth/password` | Runtime-selected password hashing |
| `@goobits/auth/mfa`, `/qr` | MFA and QR primitives |
| `@goobits/auth/security`, `/verification` | Auth-specific verification boundaries |
| `@goobits/auth/handlers`, `/login-context`, `/client` | Managed flow integration |
| `@goobits/auth/ui`, `@goobits/auth/ui/qr-code`, `@goobits/auth/ui/theme.css` | Svelte UI, QR component, and theme CSS |
| `@goobits/auth/testing`, `/errors`, `/types` | Test helpers, errors, and public types |

First-party workspaces consume checked-out source entrypoints. Registry releases
consume compiled JavaScript and declarations from `dist`.

## Runtime boundaries

- Node.js 22+ selects native Argon2 and Node WebAuthn support.
- Workers use the Worker password implementation. WebAuthn handlers currently
  return `501` there and must not be enabled.
- `@goobits/auth/node` is Node-only.
- The PostgreSQL adapter uses a minimal query port in Node and Worker runtimes.

Use the package export map and [public API](docs/public-api.md) as the exact
surface; internal source paths are not public entrypoints.

## Security boundary

The `secure` profile requires request-origin verification and required
rate-limit and audit modes; in production it also requires a shared rate-limit
store and an explicit audit emitter. `strict` requires built-in CSRF and an
explicit audit emitter in every runtime. Applications still own transactions,
database constraints and migrations, TLS, headers, trusted-proxy topology and
configuration, secrets, key rotation, alert delivery, and route-level product
authorization.

Credential-changing flows require fresh application authorization. Password
reset, token consumption, passkey limits, and cross-store credential mutations
need application-owned atomic operations. Session stores persist verifier hashes
rather than bearer cookie values, and OAuth identity links use stable provider
subjects rather than mutable email claims.

Read the [security contract](docs/security-contract.md) before production use.

## Documentation

- [Quick start](docs/quickstart.md)
- [Public API](docs/public-api.md)
- [Custom adapters](docs/integration.md)
- [Security contract](docs/security-contract.md)
- [Schema requirements](docs/schema.md)
- [Testing](docs/testing.md)
- [SvelteKit example](examples/sveltekit-quickstart/)

## Development

```bash
pnpm install --frozen-lockfile
pnpm check
```

PostgreSQL integration tests additionally require `DATABASE_URL` and run through
the dedicated `test:postgres` script.

## License

[FSL-1.1-ALv2](LICENSE) © [Goobits](https://github.com/goobits). Each version
becomes additionally available under Apache 2.0 on the second anniversary of
the date that version is made available.
