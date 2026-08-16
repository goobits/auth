import { createHash } from 'node:crypto'
import { mkdirSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

function pathContains(parent, candidate) {
	const relativePath = path.relative(parent, candidate)
	return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

/**
 * Resolve writable generated storage outside the source project.
 *
 * @param {string} projectRoot
 * @returns {{ cacheRoot: string, fingerprint: string, project: string }}
 */
export function resolveManagedStorageRoot(projectRoot) {
	const project = realpathSync.native(path.resolve(projectRoot))
	const configured = process.env.GOOBITS_CACHE_ROOT?.trim()
	if (configured && !path.isAbsolute(configured)) {
		throw new Error(`GOOBITS_CACHE_ROOT must be absolute: ${configured}`)
	}
	const configuredRoot = path.resolve(
		configured || path.join(realpathSync.native(tmpdir()), 'frontdesk', 'goobits')
	)
	if (pathContains(project, configuredRoot) || pathContains(configuredRoot, project)) {
		throw new Error(
			`Managed storage must be outside and disjoint from the project: ${configuredRoot}`
		)
	}

	mkdirSync(configuredRoot, { recursive: true })
	const cacheRoot = realpathSync.native(configuredRoot)
	if (pathContains(project, cacheRoot) || pathContains(cacheRoot, project)) {
		throw new Error(`Managed storage must be outside and disjoint from the project: ${cacheRoot}`)
	}

	return {
		cacheRoot,
		fingerprint: createHash('sha256').update(project).digest('hex').slice(0, 12),
		project
	}
}
