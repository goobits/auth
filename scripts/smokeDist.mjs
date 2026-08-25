import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
	access,
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	readdir,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url)
const root = fileURLToPath(rootUrl)
const packageJson = JSON.parse(await readFile(new URL('package.json', rootUrl), 'utf8'))
const published = packageJson.publishConfig
const nodeOnlySubpaths = new Set(['./node', './password/native-packages'])
const serverRuntimeSubpaths = new Set(['./adapters/pg'])
const uiSubpaths = new Set(['./ui', './ui/qr-code', './ui/theme.css'])
const runtimeConditions = ['types', 'workerd', 'worker', 'browser', 'node', 'default']

function packageSpecifier(subpath) {
	return subpath === '.' ? packageJson.name : `${packageJson.name}${subpath.slice(1)}`
}

function targets(value) {
	return typeof value === 'string' ? [value] : Object.values(value)
}

async function assertSourceTarget(target) {
	assert.match(target, /^\.\/src\//, `workspace target must live in src: ${target}`)
	await access(new URL(target, rootUrl))
}

async function assertDistTarget(target) {
	assert.match(target, /^\.\/dist\//, `published target must live in dist: ${target}`)
	await access(new URL(target, rootUrl))
}

async function assertWorkspaceMap() {
	assert.equal(packageJson.main, './src/index.ts')
	assert.equal(packageJson.types, './src/index.ts')
	assert.deepEqual(
		Object.keys(packageJson.exports),
		Object.keys(published.exports),
		'workspace and published export subpaths must stay aligned'
	)
	assert.deepEqual(
		Object.keys(packageJson.imports),
		Object.keys(published.imports),
		'workspace and published private imports must stay aligned'
	)

	for (const [subpath, value] of Object.entries(packageJson.exports)) {
		for (const target of targets(value)) await assertSourceTarget(target)
		if (typeof value === 'object') {
			const expected = nodeOnlySubpaths.has(subpath)
				? ['types', 'node']
				: serverRuntimeSubpaths.has(subpath)
					? ['types', 'workerd', 'worker', 'node', 'default']
					: runtimeConditions
			assert.deepEqual(Object.keys(value), expected, `${subpath} workspace conditions`)
		}
	}
	for (const [specifier, value] of Object.entries(packageJson.imports)) {
		assert.deepEqual(Object.keys(value), runtimeConditions, `${specifier} workspace conditions`)
		for (const target of targets(value)) await assertSourceTarget(target)
	}
}

async function assertPublishedMap() {
	assert.equal(published.main, './dist/node/index.js')
	assert.equal(published.types, './dist/types/index.d.ts')
	assert(packageJson.files.includes('dist'), 'published files must include dist')
	assert(!packageJson.files.includes('src'), 'published files must not include src')
	assert(!packageJson.files.includes('scripts'), 'published files must not include scripts')

	for (const [subpath, conditions] of Object.entries(published.exports)) {
		const expectedConditions =
			subpath === './ui/theme.css'
				? runtimeConditions.slice(1)
				: nodeOnlySubpaths.has(subpath)
					? ['types', 'node']
					: serverRuntimeSubpaths.has(subpath)
						? ['types', 'workerd', 'worker', 'node', 'default']
						: runtimeConditions
		assert.deepEqual(Object.keys(conditions), expectedConditions, `${subpath} published conditions`)
		for (const [condition, target] of Object.entries(conditions)) {
			await assertDistTarget(target)
			if (condition === 'types') {
				assert.match(target, /^\.\/dist\/types\/.+(?:\.d\.ts|\.svelte)$/)
			} else if (condition === 'node') {
				assert.match(target, /^\.\/dist\/node\//)
			} else {
				assert.match(target, /^\.\/dist\/worker\//)
			}
		}
	}

	for (const [specifier, conditions] of Object.entries(published.imports)) {
		assert.deepEqual(
			Object.keys(conditions),
			runtimeConditions,
			`${specifier} published conditions`
		)
		for (const target of Object.values(conditions)) await assertDistTarget(target)
	}
}

async function assertRuntimeSeparation() {
	const nodePassword = await readFile(new URL('dist/node/password/index.js', rootUrl), 'utf8')
	const workerPassword = await readFile(new URL('dist/worker/password/index.js', rootUrl), 'utf8')
	const nodeWebAuthn = await readFile(new URL('dist/node/handlers/webauthn.js', rootUrl), 'utf8')
	const workerWebAuthn = await readFile(
		new URL('dist/worker/handlers/webauthn.js', rootUrl),
		'utf8'
	)
	const nodeProviders = await readFile(new URL('dist/node/providers/index.js', rootUrl), 'utf8')
	const workerProviders = await readFile(new URL('dist/worker/providers/index.js', rootUrl), 'utf8')

	assert.match(nodePassword, /@node-rs\/argon2/)
	assert.doesNotMatch(nodePassword, /hash-wasm/)
	assert.match(workerPassword, /hash-wasm/)
	assert.doesNotMatch(workerPassword, /@node-rs\/argon2/)
	assert.match(nodeWebAuthn, /@simplewebauthn\/server/)
	assert.doesNotMatch(nodeWebAuthn, /not supported on this runtime/)
	assert.match(workerWebAuthn, /not supported on this runtime/)
	assert.doesNotMatch(workerWebAuthn, /@simplewebauthn\/server/)
	assert.match(nodeProviders, /from ['"]#password['"]/)
	assert.match(workerProviders, /from ['"]#password['"]/)
}

async function assertDistPackageScope() {
	const metadata = JSON.parse(await readFile(new URL('dist/package.json', rootUrl), 'utf8'))
	assert.equal(metadata.type, 'module', 'dist/package.json must declare type=module')
	assert.deepEqual(
		Object.keys(metadata.imports),
		Object.keys(published.imports),
		'dist/package.json must retain every private package import'
	)
	for (const [specifier, conditions] of Object.entries(published.imports)) {
		for (const [condition, target] of Object.entries(conditions)) {
			assert.equal(
				metadata.imports[specifier][condition],
				target.replace('./dist/', './'),
				`${specifier} ${condition} must resolve inside the dist package scope`
			)
		}
	}

	const directRoot = await import(new URL('dist/node/index.js', rootUrl).href)
	assert.equal(
		typeof directRoot.GoobitsAuth,
		'function',
		'direct dist import must retain ESM identity'
	)
}

async function assertUiDistribution() {
	const components = [
		'AuthGate.svelte',
		'AuthNotification.svelte',
		'BackupCodesModal.svelte',
		'OAuthProviderButton.svelte',
		'QrCode.svelte',
		'SessionManager.svelte'
	]
	const assets = ['assets/apple-mark.svg', 'assets/google-mark.svg']

	for (const output of ['node', 'worker', 'types']) {
		for (const component of components) {
			const target = `dist/${output}/ui/${component}`
			await assertDistTarget(`./${target}`)
			const source = await readFile(new URL(target, rootUrl), 'utf8')
			assert.doesNotMatch(source, /['"]\.{1,2}\/.+\.ts['"]/, `${target} imports raw TypeScript`)
		}
		for (const asset of assets) {
			const target = `dist/${output}/ui/${asset}`
			await assertDistTarget(`./${target}`)
			const source = await readFile(new URL(target, rootUrl), 'utf8')
			assert.doesNotMatch(source, /<foreignObject|data-figma|xmlns:xlink/u)
			assert.doesNotMatch(source, /(?:href|src)=["']https?:|url\(https?:/u)
		}
		await assertDistTarget(
			`./dist/${output}/ui/backupCodesModalKeyboard.${output === 'types' ? 'd.ts' : 'js'}`
		)
	}

	for (const output of ['node', 'worker']) {
		await assertDistTarget(`./dist/${output}/client/index.d.ts`)
		await assertDistTarget(`./dist/${output}/qr/index.d.ts`)
		await assertDistTarget(`./dist/${output}/qr/qrCode.d.ts`)

		const target = `dist/${output}/ui/index.js`
		const source = await readFile(new URL(target, rootUrl), 'utf8')
		assert.doesNotMatch(source, /\.svelte\.css|svelte\/internal|\$app\//)
		assert.doesNotMatch(source, /['"]\.{1,2}\/.+\.ts['"]/)
	}

	const providerButton = await readFile(
		new URL('dist/types/ui/OAuthProviderButton.svelte', rootUrl),
		'utf8'
	)
	assert.doesNotMatch(providerButton, /https?:\/\//, 'OAuth button loads a remote asset')
	assert.doesNotMatch(providerButton, /@font-face/, 'OAuth button loads a remote font')
}

async function assertSvelteDistribution() {
	for (const output of ['node', 'worker']) {
		await run('svelte-check', [
			'--workspace',
			`dist/${output}/ui`,
			'--no-tsconfig',
			'--fail-on-warnings'
		])
	}
}

function run(command, args, cwd = root) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			env: { ...process.env, npm_config_update_notifier: 'false' },
			stdio: ['ignore', 'pipe', 'pipe']
		})
		let stdout = ''
		let stderr = ''
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', (chunk) => {
			stdout += chunk
		})
		child.stderr.on('data', (chunk) => {
			stderr += chunk
		})
		child.on('error', reject)
		child.on('exit', (code) => {
			if (code === 0) {
				resolve(stdout)
			} else {
				const details = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
				reject(new Error(`${command} ${args.join(' ')} exited with ${code}\n${details}`))
			}
		})
	})
}

async function listFiles(directory, prefix = '') {
	const entries = await readdir(directory, { withFileTypes: true })
	const files = []
	for (const entry of entries) {
		const path = join(directory, entry.name)
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
		if (entry.isDirectory()) {
			files.push(...(await listFiles(path, relativePath)))
		} else {
			files.push(relativePath)
		}
	}
	return files
}

function packageSmokeSource(subpaths, runtime) {
	const specifiers = subpaths.map(packageSpecifier)
	return `import assert from 'node:assert/strict'

const expectedRoot = [
	'AuthAdapterCapabilityError',
	'AuthPrincipalResolutionError',
	'GoobitsAuth',
	'createCookieLoginContext'
]
const expectedPassword = [
	'MAX_PASSWORD_LENGTH',
	'createPasswordMigrationVerifier',
	'hashPassword',
	'validatePasswordStrength',
	'verifyPassword'
]
const root = await import('@goobits/auth')
const password = await import('@goobits/auth/password')
assert.deepEqual(Object.keys(root).sort(), expectedRoot)
assert.deepEqual(Object.keys(password).sort(), expectedPassword)
assert.match(import.meta.resolve('#password'), /\\/dist\\/${runtime}\\/password\\/index\\.js$/)
assert.match(
	import.meta.resolve('#webauthn-handlers'),
	/\\/dist\\/${runtime}\\/handlers\\/webauthn\\.js$/
)
for (const specifier of ${JSON.stringify(specifiers)}) await import(specifier)
if ('${runtime}' === 'worker') {
	const handlers = await import('@goobits/auth/handlers')
	const response = await handlers.createWebAuthnRegisterOptionsHandler({})()
	assert.equal(response.status, 501)
}
`
}

async function assertPackedPackage() {
	const tempDir = await mkdtemp(join(tmpdir(), 'goobits-auth-package-'))
	try {
		const stagingRoot = join(tempDir, 'staging')
		await mkdir(stagingRoot)
		const stagingScripts = { ...packageJson.scripts }
		delete stagingScripts.prepack
		delete stagingScripts.postpack
		await writeFile(
			join(stagingRoot, 'package.json'),
			`${JSON.stringify({ ...packageJson, scripts: stagingScripts }, null, '\t')}\n`
		)
		for (const entry of packageJson.files) {
			await cp(join(root, entry), join(stagingRoot, entry), {
				dereference: true,
				recursive: true,
				filter: (source) => !source.split('/').includes('node_modules')
			})
		}
		await symlink(join(root, 'node_modules'), join(stagingRoot, 'node_modules'), 'dir')
		await run('pnpm', ['pack', '--pack-destination', tempDir], stagingRoot)
		const tarballs = (await readdir(tempDir)).filter((file) => file.endsWith('.tgz'))
		assert.equal(tarballs.length, 1, 'package verification must produce exactly one tarball')
		await run('tar', ['-xzf', join(tempDir, tarballs[0]), '-C', tempDir])

		const installedRoot = join(tempDir, 'package')
		const installedManifest = JSON.parse(
			await readFile(join(installedRoot, 'package.json'), 'utf8')
		)
		assert.equal(installedManifest.main, published.main)
		assert.equal(installedManifest.types, published.types)
		assert.deepEqual(installedManifest.imports, published.imports)
		assert.deepEqual(installedManifest.exports, published.exports)
		assert.deepEqual(installedManifest.publishConfig, { access: 'public' })

		const packedFiles = await listFiles(installedRoot)
		for (const required of [
			'dist/package.json',
			'dist/node/index.js',
			'dist/worker/index.js',
			'dist/types/index.d.ts',
			'dist/types/ui/AuthGate.svelte',
			'dist/types/ui/OAuthProviderButton.svelte',
			'dist/types/ui/assets/apple-mark.svg',
			'dist/types/ui/assets/google-mark.svg'
		]) {
			assert(packedFiles.includes(required), `packed artifact is missing ${required}`)
		}
		assert(!packedFiles.some((path) => path.startsWith('src/')), 'packed artifact contains source')
		assert(
			!packedFiles.some((path) => path.startsWith('scripts/')),
			'packed artifact contains scripts'
		)

		await symlink(join(root, 'node_modules'), join(installedRoot, 'node_modules'), 'dir')
		const importableSubpaths = Object.keys(installedManifest.exports).filter(
			(subpath) => !uiSubpaths.has(subpath)
		)
		const nodeSmoke = join(installedRoot, 'smoke-node.mjs')
		const workerSmoke = join(installedRoot, 'smoke-worker.mjs')
		await writeFile(nodeSmoke, packageSmokeSource(importableSubpaths, 'node'))
		await writeFile(
			workerSmoke,
			packageSmokeSource(
				importableSubpaths.filter((subpath) => !nodeOnlySubpaths.has(subpath)),
				'worker'
			)
		)
		await run(process.execPath, [nodeSmoke], installedRoot)
		await run(process.execPath, ['--conditions=worker', workerSmoke], installedRoot)
	} finally {
		await rm(tempDir, { recursive: true, force: true })
	}
}

async function linkExternalDistDependencies() {
	const distRoot = await realpath(join(root, 'dist'))
	const relativeDist = relative(root, distRoot)
	const isExternal = relativeDist.startsWith('..') || isAbsolute(relativeDist)
	if (!isExternal) return async () => {}

	const dependencyLink = join(distRoot, 'node_modules')
	try {
		await lstat(dependencyLink)
		return async () => {}
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error
	}

	await symlink(join(root, 'node_modules'), dependencyLink, 'dir')
	return () => unlink(dependencyLink)
}

const unlinkExternalDistDependencies = await linkExternalDistDependencies()
try {
	await assertWorkspaceMap()
	await assertPublishedMap()
	await assertDistPackageScope()
	await assertRuntimeSeparation()
	await assertUiDistribution()
	await assertSvelteDistribution()
	await assertPackedPackage()
} finally {
	await unlinkExternalDistDependencies()
}

console.log('workspace source and published package smoke passed')
