# Public API (curated)

This package exposes a small set of entrypoints. Everything else is internal.

## Entry points

- `@goobits/auth`
  - `createAuth`
- `@goobits/auth/adapters`
- `@goobits/auth/adapters/database`
- `@goobits/auth/adapters/session`
- `@goobits/auth/adapters/oauth-token`
- `@goobits/auth/adapters/verification-token`
- `@goobits/auth/adapters/magic-link`
- `@goobits/auth/adapters/webauthn`
- `@goobits/auth/providers`
- `@goobits/auth/handlers`
- `@goobits/auth/utils`
- `@goobits/auth/client`
- `@goobits/auth/types`
- `@goobits/auth/mfa`
- `@goobits/auth/ui`
- `@goobits/auth/security`
- `@goobits/auth/errors`

## CodeAtlas

Use CodeAtlas to verify the public surface:

```
npm run api:scan
```

This uses entrypoints that match `package.json` exports.

## Behavioral Notes

- `hooks.onLogin` is for principal resolution; session issuance remains managed by auth handlers unless `hooks.onLoginMode` is `"manual"`.
- Login flows now fail deterministically when no authenticated principal can be resolved.
- Session revoke endpoints return `501` for unsupported adapter capabilities.
