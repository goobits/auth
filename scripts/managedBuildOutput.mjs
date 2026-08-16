import { lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs'
import path from 'node:path'

import { resolveManagedStorageRoot } from './managedStorageRoot.mjs'

const outputNamePattern = /^[a-z0-9][a-z0-9._-]*$/

export function ensureManagedBuildOutput(projectRoot, name) {
	if (!outputNamePattern.test(name)) throw new Error(`Managed output name is invalid: ${name}`)
	const { cacheRoot, fingerprint, project } = resolveManagedStorageRoot(projectRoot)
	const target = path.join(cacheRoot, 'build-storage', fingerprint, 'build', 'outputs', name)
	const output = path.join(project, name)
	mkdirSync(target, { recursive: true })

	try {
		const details = lstatSync(output)
		if (!details.isSymbolicLink()) {
			throw new Error(`Workspace-local build output must be migrated before use: ${output}`)
		}
		const currentTarget = path.resolve(path.dirname(output), readlinkSync(output))
		if (realpathSync.native(currentTarget) !== realpathSync.native(target)) {
			throw new Error(`Managed build link has the wrong target: ${output} -> ${currentTarget}`)
		}
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error
		symlinkSync(target, output, 'dir')
	}
	return output
}
