import path from 'path'
import type { UserConfig } from 'vite'
import { getRuntimeEnv } from '../env'

export function getViteRuntimeConfig(
	env: Record<string, string | undefined>,
	packageVersion: string
): Pick<UserConfig, 'define' | 'resolve' | 'server'> {
	const runtime = getRuntimeEnv(env)
	const server: NonNullable<UserConfig['server']> = {
		host: runtime.host,
		open: false,
		port: runtime.port,
		proxy: {}
	}

	if (runtime.httpsKey && runtime.httpsCert) {
		server.https = {
			key: runtime.httpsKey,
			cert: runtime.httpsCert
		}
	}

	return {
		define: {
			'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageVersion),
			'import.meta.env.RECAPTCHA_SITE_KEY': JSON.stringify(runtime.recaptchaSiteKey),
			__SVELTEKIT_PATHS_BASE__: JSON.stringify(''),
			__SVELTEKIT_PATHS_ASSETS__: JSON.stringify(''),
			__SVELTEKIT_APP_DIR__: JSON.stringify('_app'),
			__SVELTEKIT_PATHS_RELATIVE__: 'false'
		},
		resolve: {
			alias: {
				'@node-rs/argon2': path.resolve('src/lib/stubs/argon2.ts'),
				'argon2': path.resolve('src/lib/stubs/argon2.ts'),
				'@node-rs/bcrypt': path.resolve('src/lib/stubs/bcrypt.ts'),
				'bcrypt': path.resolve('src/lib/stubs/bcrypt.ts')
			}
		},
		server
	}
}
