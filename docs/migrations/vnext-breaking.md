# vNext Breaking Migration

## Summary

- Primary API is now `new GoobitsAuth({...})`.
- Preferred adapter key is singular: `adapter`.
- `drizzleAdapter(db, { schema })` is the one-stop Drizzle bundle.
- `DatabaseAdapter` has been renamed to `UserAdapter`.
- Adapter base classes are `abstract` and enforce compile-time implementation.
- Logout handlers are `RequestHandler`-first.

## Before/After

### Auth instance

Before:

```ts
import { createAuth } from "@goobits/auth";

const auth = createAuth({
  adapters: { session, user, oauthToken },
  providers: { google: { provider: googleProvider } },
});
```

After:

```ts
import { GoobitsAuth } from "@goobits/auth";
import { drizzleAdapter } from "@goobits/auth/adapters/drizzle";

const auth = new GoobitsAuth({
  adapter: drizzleAdapter(db, { schema }),
  providers: { google: { provider: googleProvider } },
});
```

### SvelteKit plumbing

Before (manual hook + route handlers):

```ts
// custom cookie/session plumbing in hooks and routes
```

After:

```ts
// hooks.server.ts
export const handle = auth.handle();

// routes/auth/[...auth]/+server.ts
export const { GET, POST } = auth.handlers;
```

### Adapter naming

Before:

```ts
adapters: {
  session,
  database: userAdapter,
}
```

After:

```ts
adapter: {
  session,
  user: userAdapter,
}
```

### Credentials method

Before:

```ts
userAdapter._getUserWithPassword(email);
```

After:

```ts
userAdapter.getUserWithPasswordHash(email);
```

## Testing utilities

`@goobits/auth/testing` exports mock adapters:

- `MockSessionAdapter`
- `MockUserAdapter`
- `MockTokenAdapter`
