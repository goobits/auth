import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url)

const nodeSubpaths = [
	'index.js',
	'adapters/index.js',
	'adapters/database/index.js',
	'adapters/session/index.js',
	'adapters/oauth-token/index.js',
	'adapters/drizzle/index.js',
	'adapters/memory/index.js',
	'adapters/pg/index.js',
	'adapters/verification-token/index.js',
	'adapters/magic-link/index.js',
	'adapters/webauthn/index.js',
	'client/index.js',
	'errors/index.js',
	'handlers/index.js',
	'login-context/index.js',
	'providers/index.js',
	'password/index.js',
	'testing/index.js',
	'types/index.js',
	'mfa/index.js',
	'node/index.js',
	'security/index.js',
	'utils/index.js'
]

async function importBuiltNodeSubpaths() {
	for (const subpath of nodeSubpaths) {
		const file = new URL(`dist/node/${ subpath }`, root)
		await import(file.href)
	}
}

async function assertPublicSurface() {
	const rootApi = await import(new URL('dist/node/index.js', root).href)
	const rootExports = Object.keys(rootApi).sort()
	const expectedRoot = [
		'AuthAdapterCapabilityError',
		'AuthPrincipalResolutionError',
		'GoobitsAuth',
		'createCookieLoginContext'
	]
	if (rootExports.join(',') !== expectedRoot.join(',')) {
		throw new Error(`unexpected root exports: ${ rootExports.join(', ') }`)
	}

	const passwordApi = await import(new URL('dist/node/password/index.js', root).href)
	const passwordExports = Object.keys(passwordApi).sort()
	const expectedPassword = [
		'hashPassword',
		'validatePasswordStrength',
		'verifyPassword'
	]
	if (passwordExports.join(',') !== expectedPassword.join(',')) {
		throw new Error(`unexpected password exports: ${ passwordExports.join(', ') }`)
	}
}

async function assertFileExists(path) {
	await access(new URL(path, root))
}

async function assertUiBarrelUsesRawSvelte() {
	const source = await readFile(new URL('dist/node/ui/index.js', root), 'utf8')
	const forbiddenImports = [
		'.svelte.css',
		'svelte/internal',
		'svelte/internal/client',
		'svelte/internal/disclose-version'
	]
	for (const importPath of forbiddenImports) {
		if (source.includes(importPath)) {
			throw new Error(`dist/node/ui/index.js contains bundled Svelte import: ${ importPath }`)
		}
	}
	for (const component of [
		'AuthGate.svelte',
		'AuthNotification.svelte',
		'BackupCodesModal.svelte',
		'SessionManager.svelte'
	]) {
		await assertFileExists(join('dist/node/ui', component))
		await assertFileExists(join('dist/worker/ui', component))
	}
	const authStore = await readFile(new URL('dist/node/ui/authStore.js', root), 'utf8')
	if (authStore.includes('$app/')) {
		throw new Error('dist/node/ui/authStore.js contains a SvelteKit ambient import')
	}
}

await importBuiltNodeSubpaths()
await assertPublicSurface()
await assertUiBarrelUsesRawSvelte()

console.log('dist smoke passed')
