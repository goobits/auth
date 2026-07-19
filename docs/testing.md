# Testing

Run the package checks from the package root:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run test:dist
```

`test:dist` treats `package.json` as the public entrypoint inventory. It checks
that every Node, Worker, and declaration target exists and imports, verifies
the runtime-specific password/WebAuthn builds, checks the copied Svelte UI
assets, and inspects the packed file list so source and release tooling cannot
leak into the published package.

## Integration Tests

`pnpm run test:integration` exercises the Drizzle adapters.

By default, the test fixture uses `pg-mem`, so no external database is required.
To run the same tests against PostgreSQL, select the required-service owner and
set `DATABASE_URL`:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/auth_test pnpm run test:postgres
```

`test:postgres` fails fast without `DATABASE_URL` and runs the integration files
serially. The fixture creates the small `users`, `sessions`, `oauth_tokens`, and
`magic_link_tokens` tables it needs. Use a disposable test database when
setting `DATABASE_URL`.
