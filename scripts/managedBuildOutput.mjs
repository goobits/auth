import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs'
import path from 'node:path'

import { resolveManagedStorageRoot } from './managedStorageRoot.mjs'

const outputNamePattern = /^[a-z0-9][a-z0-9._-]*$/

function resolveManagedBuildOutput(projectRoot, name) {
	if (!outputNamePattern.test(name)) throw new Error(`Managed output name is invalid: ${name}`)
	const { cacheRoot, fingerprint, project } = resolveManagedStorageRoot(projectRoot)
	const target = path.join(cacheRoot, 'build-storage', fingerprint, 'build', 'outputs', name)
	const output = path.join(project, name)
	const packState = path.join(path.dirname(target), `.${name}.pack-state`)
	mkdirSync(target, { recursive: true })
	return { output, packState, target }
}

export function ensureManagedBuildOutput(projectRoot, name) {
	const { output, target } = resolveManagedBuildOutput(projectRoot, name)

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

export function materializeManagedBuildOutput(projectRoot, name) {
	const { output, packState, target } = resolveManagedBuildOutput(projectRoot, name)
	ensureManagedBuildOutput(projectRoot, name)
	writeFileSync(packState, `${output}\n`)
	rmSync(output)
	cpSync(target, output, { recursive: true })
}

export function restoreManagedBuildOutput(projectRoot, name) {
	const { output, packState, target } = resolveManagedBuildOutput(projectRoot, name)
	if (!existsSync(packState)) return ensureManagedBuildOutput(projectRoot, name)
	if (readFileSync(packState, 'utf8').trim() !== output) {
		throw new Error(`Managed pack state does not match output: ${packState}`)
	}
	rmSync(output, { force: true, recursive: true })
	symlinkSync(target, output, 'dir')
	rmSync(packState)
	return output
}
