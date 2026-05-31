import { join } from 'node:path'

import { defineConfig, type Options } from 'tsup'

function rewritePlugin(rewrites: Array<{ from: RegExp; to: (path: string) => string }>) {
	return {
		name: 'rewrite-plugin',
		setup(build: any) {
			build.onResolve({ filter: /.*/ }, (args: any) => {
				for (const rule of rewrites) {
					if (rule.from.test(args.path)) {
						const next = rule.to(args.path)
						if (next.startsWith('.')) {
							return { path: join(args.resolveDir, next) }
						}
						return { path: next }
					}
				}
				return null
			})
		}
	}
}

const commonEntries = [
	'src/index.ts',
	'src/adapters/index.ts',
	'src/adapters/database/index.ts',
	'src/adapters/session/index.ts',
	'src/adapters/oauth-token/index.ts',
	'src/adapters/drizzle/index.ts',
	'src/adapters/memory/index.ts',
	'src/adapters/verification-token/index.ts',
	'src/adapters/magic-link/index.ts',
	'src/adapters/mfa/index.ts',
	'src/adapters/webauthn/index.ts',
	'src/providers/index.ts',
	'src/handlers/index.ts',
	'src/login-context/index.ts',
	'src/utils/index.ts',
	'src/client/index.ts',
	'src/password/index.ts',
	'src/types/index.ts',
	'src/testing/index.ts',
	'src/mfa/index.ts',
	'src/ui/auth-store.ts',
	'src/security/index.ts',
	'src/errors/index.ts'
]

const nodeEntries = [
	...commonEntries,
	'src/adapters/pg/index.ts',
	'src/node/index.ts'
]

const common: Options = {
	entry: commonEntries,
	format: [ 'esm' ],
	target: 'es2022',
	splitting: false,
	sourcemap: false,
	treeshake: true,
	clean: false,
	skipNodeModulesBundle: true
}

export default defineConfig([
	{
		...common,
		entry: nodeEntries,
		outDir: 'dist/node',
		esbuildPlugins: [
			rewritePlugin([
				{
					from: /(^|\/)password\/index\.ts$/,
					to: p => p.replace(/index\.ts$/, 'index.node.ts')
				}
			])
		]
	},
	{
		...common,
		outDir: 'dist/worker',
		esbuildPlugins: [
			rewritePlugin([
				{
					from: /(^|\/)webauthn\.ts$/,
					to: p => p.replace(/webauthn\.ts$/, 'webauthn.worker.ts')
				}
			])
		]
	}
])
