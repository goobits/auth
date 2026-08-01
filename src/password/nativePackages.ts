import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const argon2Package = require('@node-rs/argon2/package.json') as {
	optionalDependencies?: Record<string, string>
}

/** Native Argon2 packages that server bundlers must leave for Node to load. */
export const ARGON2_NATIVE_PACKAGE_IDS: readonly string[] = Object.freeze([
	'@node-rs/argon2',
	...Object.keys(argon2Package.optionalDependencies ?? {})
])
