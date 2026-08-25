import {
	lstatSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	ensureManagedBuildOutput,
	materializeManagedBuildOutput,
	restoreManagedBuildOutput
} from '../../scripts/managedBuildOutput.ts'
import { resolveManagedStorageRoot } from '../../scripts/managedStorageRoot.ts'

const temporaryDirectories: string[] = []

const makeTemporaryDirectory = (name: string): string => {
	const directory = mkdtempSync(path.join(tmpdir(), name))
	temporaryDirectories.push(directory)
	return directory
}

afterEach(() => {
	vi.unstubAllEnvs()
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { force: true, recursive: true })
	}
})

describe('managed artifact storage', () => {
	it('uses the operating-system temporary directory by default', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		const temporaryRoot = makeTemporaryDirectory('auth-storage-tmp-')
		vi.stubEnv('GOOBITS_CACHE_ROOT', '')
		vi.stubEnv('TMPDIR', temporaryRoot)

		const { cacheRoot, fingerprint } = resolveManagedStorageRoot(projectRoot)
		const expectedRoot = path.join(realpathSync.native(temporaryRoot), 'frontdesk', 'goobits')

		expect(cacheRoot).toBe(expectedRoot)
		expect(fingerprint).toMatch(/^[a-f0-9]{12}$/)
	})

	it('accepts an absolute cache root outside the project', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		const cacheRoot = makeTemporaryDirectory('auth-storage-cache-')
		vi.stubEnv('GOOBITS_CACHE_ROOT', cacheRoot)

		const resolved = resolveManagedStorageRoot(projectRoot)

		expect(resolved.cacheRoot).toBe(realpathSync.native(cacheRoot))
	})

	it('rejects relative and project-contained cache roots', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		vi.stubEnv('GOOBITS_CACHE_ROOT', 'relative/cache')
		expect(() => resolveManagedStorageRoot(projectRoot)).toThrow(
			'GOOBITS_CACHE_ROOT must be absolute'
		)

		vi.stubEnv('GOOBITS_CACHE_ROOT', path.join(projectRoot, 'cache'))
		expect(() => resolveManagedStorageRoot(projectRoot)).toThrow(
			'Managed storage must be outside and disjoint from the project'
		)
	})

	it('links build output to managed external storage', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		const cacheRoot = makeTemporaryDirectory('auth-storage-cache-')
		vi.stubEnv('GOOBITS_CACHE_ROOT', cacheRoot)

		const output = ensureManagedBuildOutput(projectRoot, 'dist')
		const target = realpathSync.native(path.resolve(path.dirname(output), readlinkSync(output)))

		expect(lstatSync(output).isSymbolicLink()).toBe(true)
		expect(
			target.startsWith(`${path.join(realpathSync.native(cacheRoot), 'build-storage')}${path.sep}`)
		).toBe(true)
	})

	it('does not replace an existing workspace output directory', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		const cacheRoot = makeTemporaryDirectory('auth-storage-cache-')
		const output = path.join(projectRoot, 'dist')
		mkdirSync(output)
		writeFileSync(path.join(output, 'keep.txt'), 'keep')
		vi.stubEnv('GOOBITS_CACHE_ROOT', cacheRoot)

		expect(() => ensureManagedBuildOutput(projectRoot, 'dist')).toThrow(
			'Workspace-local build output must be migrated before use'
		)
		expect(lstatSync(path.join(output, 'keep.txt')).isFile()).toBe(true)
	})

	it('materializes package output and restores the managed link', () => {
		const projectRoot = makeTemporaryDirectory('auth-storage-project-')
		const cacheRoot = makeTemporaryDirectory('auth-storage-cache-')
		vi.stubEnv('GOOBITS_CACHE_ROOT', cacheRoot)

		const output = ensureManagedBuildOutput(projectRoot, 'dist')
		const target = realpathSync.native(path.resolve(path.dirname(output), readlinkSync(output)))
		writeFileSync(path.join(target, 'index.js'), 'export {}\n')

		materializeManagedBuildOutput(projectRoot, 'dist')
		expect(lstatSync(output).isDirectory()).toBe(true)
		expect(readFileSync(path.join(output, 'index.js'), 'utf8')).toBe('export {}\n')

		restoreManagedBuildOutput(projectRoot, 'dist')
		expect(lstatSync(output).isSymbolicLink()).toBe(true)
		expect(realpathSync.native(output)).toBe(target)
	})
})
