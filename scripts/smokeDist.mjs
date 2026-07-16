import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const nodeOnlySubpaths = new Set(['./adapters/pg', './node'])
const uiSubpaths = new Set(['./ui', './ui/theme.css'])

function packageSpecifier(subpath) {
	return subpath === '.' ? packageJson.name : `${packageJson.name}${subpath.slice(1)}`
}

async function assertFileExists(target) {
	assert.match(target, /^\.\/dist\//, `export target must live in dist: ${target}`)
	await access(new URL(target, root))
}

async function assertExportMap() {
	assert.equal(packageJson.main, './dist/node/index.js')
	assert.equal(packageJson.types, './dist/types/index.d.ts')
	assert(packageJson.files.includes('dist'), 'published files must include dist')
	assert(!packageJson.files.includes('src'), 'published files must not include src')
	assert(!packageJson.files.includes('scripts'), 'published files must not include scripts')

	for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
		assert.equal(typeof conditions, 'object', `${subpath} must use conditional exports`)
		const expectedConditions =
			subpath === './ui/theme.css'
				? ['workerd', 'worker', 'browser', 'node', 'default']
				: nodeOnlySubpaths.has(subpath)
					? ['types', 'node']
					: ['types', 'workerd', 'worker', 'browser', 'node', 'default']

		assert.deepEqual(
			Object.keys(conditions),
			expectedConditions,
			`${subpath} has an inconsistent Node/Worker export shape`
		)

		for (const [condition, target] of Object.entries(conditions)) {
			assert.equal(typeof target, 'string', `${subpath} ${condition} target must be a string`)
			await assertFileExists(target)
			if (condition === 'types') {
				assert.match(target, /^\.\/dist\/types\/.+\.d\.ts$/)
			} else if (condition === 'node') {
				assert.match(target, /^\.\/dist\/node\//)
			} else {
				assert.match(target, /^\.\/dist\/worker\//)
			}
		}
	}
}

async function importBuiltEntrypoints() {
	for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
		if (uiSubpaths.has(subpath)) continue

		await import(packageSpecifier(subpath))
		if ('default' in conditions && conditions.default.endsWith('.js')) {
			await import(new URL(conditions.default, root).href)
		}
	}
}

async function assertPublicSurface() {
	const expectedRoot = [
		'AuthAdapterCapabilityError',
		'AuthPrincipalResolutionError',
		'GoobitsAuth',
		'createCookieLoginContext'
	]
	for (const target of ['dist/node/index.js', 'dist/worker/index.js']) {
		const api = await import(new URL(target, root).href)
		assert.deepEqual(Object.keys(api).sort(), expectedRoot)
	}

	const expectedPassword = [
		'MAX_PASSWORD_LENGTH',
		'createPasswordMigrationVerifier',
		'hashPassword',
		'validatePasswordStrength',
		'verifyPassword'
	]
	for (const target of ['dist/node/password/index.js', 'dist/worker/password/index.js']) {
		const api = await import(new URL(target, root).href)
		assert.deepEqual(Object.keys(api).sort(), expectedPassword)
	}
}

async function assertRuntimeSeparation() {
	const nodePassword = await readFile(new URL('dist/node/password/index.js', root), 'utf8')
	const workerPassword = await readFile(new URL('dist/worker/password/index.js', root), 'utf8')
	const nodeRoot = await readFile(new URL('dist/node/index.js', root), 'utf8')
	const workerRoot = await readFile(new URL('dist/worker/index.js', root), 'utf8')

	assert.match(nodePassword, /@node-rs\/argon2/)
	assert.doesNotMatch(nodePassword, /hash-wasm/)
	assert.match(workerPassword, /hash-wasm/)
	assert.doesNotMatch(workerPassword, /@node-rs\/argon2/)
	assert.match(nodeRoot, /@simplewebauthn\/server/)
	assert.doesNotMatch(workerRoot, /@simplewebauthn\/server/)
}

async function assertUiDistribution() {
	const components = [
		'AuthGate.svelte',
		'AuthNotification.svelte',
		'BackupCodesModal.svelte',
		'QrCode.svelte',
		'SessionManager.svelte'
	]

	for (const output of ['node', 'worker', 'types']) {
		for (const component of components) {
			const target = `dist/${output}/ui/${component}`
			await assertFileExists(`./${target}`)
			const source = await readFile(new URL(target, root), 'utf8')
			assert.doesNotMatch(source, /['"]\.{1,2}\/.+\.ts['"]/, `${target} imports raw TypeScript`)
		}
	}

	for (const output of ['node', 'worker']) {
		const target = `dist/${output}/ui/index.js`
		const source = await readFile(new URL(target, root), 'utf8')
		assert.doesNotMatch(source, /\.svelte\.css|svelte\/internal|\$app\//)
		assert.doesNotMatch(source, /['"]\.{1,2}\/.+\.ts['"]/)
	}
}

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: new URL('.', root),
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
				reject(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr}`))
			}
		})
	})
}

async function assertPackedFiles() {
	const output = await run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'])
	const [result] = JSON.parse(output)
	const files = result.files.map((file) => file.path)

	for (const required of [
		'dist/node/index.js',
		'dist/worker/index.js',
		'dist/types/index.d.ts',
		'dist/types/ui/AuthGate.svelte'
	]) {
		assert(files.includes(required), `packed artifact is missing ${required}`)
	}
	assert(!files.some((path) => path.startsWith('src/')), 'packed artifact contains source files')
	assert(
		!files.some((path) => path.startsWith('scripts/')),
		'packed artifact contains release tooling'
	)
}

await assertExportMap()
await importBuiltEntrypoints()
await assertPublicSurface()
await assertRuntimeSeparation()
await assertUiDistribution()
await assertPackedFiles()

console.log('dist and package smoke passed')
