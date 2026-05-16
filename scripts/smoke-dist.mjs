import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);

const nodeSubpaths = [
	"index.js",
	"adapters/index.js",
	"adapters/database/index.js",
	"adapters/session/index.js",
	"adapters/oauth-token/index.js",
	"adapters/drizzle/index.js",
	"adapters/memory/index.js",
	"adapters/pg/index.js",
	"adapters/verification-token/index.js",
	"adapters/magic-link/index.js",
	"adapters/webauthn/index.js",
	"providers/index.js",
	"handlers/index.js",
	"utils/index.js",
	"client/index.js",
	"types/index.js",
	"testing/index.js",
	"mfa/index.js",
	"node/index.js",
	"security/index.js",
	"errors/index.js",
];

async function importBuiltNodeSubpaths() {
	for (const subpath of nodeSubpaths) {
		const file = new URL(`dist/node/${subpath}`, root);
		await import(file.href);
	}
}

async function assertPublicSurface() {
	const rootApi = await import(new URL("dist/node/index.js", root).href);
	const rootExports = Object.keys(rootApi).sort();
	if (rootExports.join(",") !== "GoobitsAuth") {
		throw new Error(`unexpected root exports: ${rootExports.join(", ")}`);
	}

	const utilsApi = await import(new URL("dist/node/utils/index.js", root).href);
	const utilsExports = Object.keys(utilsApi).sort();
	const expectedUtils = [
		"hashPassword",
		"validatePasswordStrength",
		"verifyPassword",
	];
	if (utilsExports.join(",") !== expectedUtils.join(",")) {
		throw new Error(`unexpected utils exports: ${utilsExports.join(", ")}`);
	}
}

async function assertFileExists(path) {
	await access(new URL(path, root));
}

async function assertUiBarrelUsesRawSvelte() {
	const source = await readFile(new URL("dist/node/ui/index.js", root), "utf8");
	const forbiddenImports = [
		".svelte.css",
		"svelte/internal",
		"svelte/internal/client",
		"svelte/internal/disclose-version",
	];
	for (const importPath of forbiddenImports) {
		if (source.includes(importPath)) {
			throw new Error(`dist/node/ui/index.js contains bundled Svelte import: ${importPath}`);
		}
	}
	for (const component of [
		"AuthGate.svelte",
		"AuthNotification.svelte",
		"BackupCodesModal.svelte",
		"MigrationNotification.svelte",
		"SessionManager.svelte",
	]) {
		await assertFileExists(join("dist/node/ui", component));
		await assertFileExists(join("dist/worker/ui", component));
	}
}

await importBuiltNodeSubpaths();
await assertPublicSurface();
await assertUiBarrelUsesRawSvelte();

console.log("dist smoke passed");
