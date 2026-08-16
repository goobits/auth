# SvelteKit Quickstart Example

This example shows the minimum SvelteKit wiring expected by `@goobits/auth`.

It is intentionally small and uses placeholder imports for your app database,
schema, and durable audit emitter. Replace the process-local rate-limit store
before production, and supply a shared `AUTH_CSRF_SECRET` containing at least
32 bytes. To test against a local package tarball, publish or pack the auth
package first, then install it into a SvelteKit app:

```sh
cd ../../
pnpm pack
cd examples/sveltekit-quickstart
pnpm add ../../goobits-auth-*.tgz
```

The important files are:

- `src/lib/auth.ts`
- `src/hooks.server.ts`
- `src/routes/auth/[...auth]/+server.ts`

## License

This example follows the repository's Functional Source License, Version 1.1,
ALv2 Future License. See [the repository license](../../LICENSE).
