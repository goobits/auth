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
To run the same tests against Postgres, set `DATABASE_URL`:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/auth_test pnpm run test:integration
```

The fixture creates the small `users`, `sessions`, and `oauth_tokens` tables it
needs. Use a disposable test database when setting `DATABASE_URL`.
