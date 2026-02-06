# vNext Breaking Migration

## Summary

- `DatabaseAdapter` has been renamed to `UserAdapter`.
- `createAuth` adapter key changed from `adapters.database` to `adapters.user`.
- `DatabaseAdapter._getUserWithPassword` has been renamed to `UserAdapter.getUserWithPasswordHash`.
- Adapter base classes are now `abstract` and enforce compile-time implementation.
- `createLogoutHandler` now returns a `RequestHandler` (`POST`) instead of `Actions`.
  For action-style routes, use `createLogoutAction`.

## Before/After

### Adapter key

Before:

```ts
createAuth({
  adapters: {
    session,
    database: userAdapter,
  },
});
```

After:

```ts
createAuth({
  adapters: {
    session,
    user: userAdapter,
  },
});
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

### Logout handler

Before:

```ts
export const actions = createLogoutHandler({ sessionAdapter });
```

After:

```ts
export const POST = createLogoutHandler({ sessionAdapter });
// or:
export const actions = createLogoutAction({ sessionAdapter });
```

## Testing utilities

`@goobits/auth/testing` now exports mock adapters:

- `MockSessionAdapter`
- `MockUserAdapter`
- `MockTokenAdapter`
