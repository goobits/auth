#!/usr/bin/env bash
set -euo pipefail

echo "==> Cloudflare predeploy check"

if ! command -v pnpm >/dev/null 2>&1; then
	echo "ERROR: pnpm is not installed."
	exit 1
fi

if ! test -f wrangler.toml; then
	echo "ERROR: wrangler.toml not found."
	exit 1
fi

if rg -n '00000000-0000-0000-0000-000000000000' wrangler.toml >/dev/null; then
	echo "ERROR: wrangler.toml still has placeholder D1 IDs."
	echo "Set real values for database_id and preview_database_id."
	exit 1
fi

if ! pnpm exec wrangler whoami >/dev/null 2>&1; then
	echo "ERROR: Wrangler is not authenticated."
	echo "Run: pnpm exec wrangler login"
	echo "Or set CLOUDFLARE_API_TOKEN in your environment."
	exit 1
fi

echo "Wrangler auth: OK"

echo "Running validate..."
pnpm validate

if ! test -d .svelte-kit/cloudflare; then
	echo "ERROR: Build output directory .svelte-kit/cloudflare not found."
	echo "Run: pnpm build"
	exit 1
fi

echo "Build output: OK (.svelte-kit/cloudflare)"
echo "Predeploy check passed."
