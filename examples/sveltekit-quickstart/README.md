# SvelteKit Quickstart Example

This example shows the minimum SvelteKit wiring expected by `@goobits/auth`.

It is intentionally small and uses placeholder imports for your app database
and schema. To test against a local package tarball, publish or pack the auth
package first, then install it into a SvelteKit app:

```sh
cd ../../
pnpm pack
cd examples/sveltekit-quickstart
pnpm add ../../goobits-auth-0.2.0.tgz
```

The important files are:

- `src/lib/auth.ts`
- `src/hooks.server.ts`
- `src/routes/auth/[...auth]/+server.ts`
