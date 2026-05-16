# Testing

Run the package checks from the package root:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run test:dist
```

## Integration Tests

`pnpm run test:integration` exercises the Drizzle adapters.

By default, the test fixture uses `pg-mem`, so no external database is required.
To run the same tests against Postgres, set `DATABASE_URL`:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/auth_test pnpm run test:integration
```

The fixture creates the small `users`, `sessions`, and `oauth_tokens` tables it
needs. Use a disposable test database when setting `DATABASE_URL`.
