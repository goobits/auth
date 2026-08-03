import { defineConfig, type Options } from 'tsup'

const commonEntries = [
	'src/index.ts',
	'src/adapters/index.ts',
	'src/adapters/database/index.ts',
	'src/adapters/session/index.ts',
	'src/adapters/oauth-token/index.ts',
	'src/adapters/oauth-identity/index.ts',
	'src/adapters/drizzle/index.ts',
	'src/adapters/memory/index.ts',
	'src/adapters/verification-token/index.ts',
	'src/adapters/magic-link/index.ts',
	'src/adapters/mfa/index.ts',
	'src/adapters/webauthn/index.ts',
	'src/providers/index.ts',
	'src/handlers/index.ts',
	'src/handlers/webauthn.ts',
	'src/login-context/index.ts',
	'src/verification/index.ts',
	'src/client/index.ts',
	'src/password/index.ts',
	'src/types/index.ts',
	'src/testing/index.ts',
	'src/mfa/index.ts',
	'src/qr/index.ts',
	'src/ui/authStore.ts',
	'src/ui/backupCodesModalKeyboard.ts',
	'src/security/index.ts',
	'src/errors/index.ts'
]

const toEntryMap = (entries: string[], overrides: Record<string, string> = {}) =>
	Object.fromEntries(
		entries.map((entry) => {
			const output = entry.replace(/^src\//, '').replace(/\.ts$/, '')
			return [output, overrides[output] ?? entry]
		})
	)

const nodeEntries = toEntryMap(
	[
		...commonEntries,
		'src/adapters/pg/index.ts',
		'src/node/index.ts',
		'src/password/nativePackages.ts'
	],
	{ 'password/index': 'src/password/index.node.ts' }
)
const workerEntries = toEntryMap(commonEntries, {
	'handlers/webauthn': 'src/handlers/webauthn.worker.ts'
})

const common: Options = {
	entry: commonEntries,
	format: ['esm'],
	target: 'es2022',
	splitting: false,
	sourcemap: false,
	treeshake: true,
	clean: false,
	skipNodeModulesBundle: true,
	noExternal: ['@goobits/security']
}

export default defineConfig([
	{
		...common,
		entry: nodeEntries,
		outDir: 'dist/node',
		platform: 'node',
		esbuildOptions(options) {
			options.conditions = ['node']
		}
	},
	{
		...common,
		entry: workerEntries,
		outDir: 'dist/worker',
		platform: 'browser',
		esbuildOptions(options) {
			options.conditions = ['workerd', 'worker', 'browser']
		}
	}
])
