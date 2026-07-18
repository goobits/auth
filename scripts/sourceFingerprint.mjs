import { createHash } from 'node:crypto'
import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const packageRoot = join(here, '..')
const fingerprintPath = join(packageRoot, 'dist', '.source-fingerprint')

const requiredInputs = [
	'src',
	'package.json',
	'tsconfig.build.json',
	'tsup.config.ts',
	'scripts/finalizeDist.mjs',
	'scripts/sourceFingerprint.mjs'
]
const workspaceInputs = ['../security/src', '../security/package.json']
const requiredOutputs = ['dist/node/index.js', 'dist/worker/index.js', 'dist/types/index.d.ts']

async function exists(path) {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

async function collectFiles(path, output) {
	const details = await stat(path)
	if (details.isFile()) {
		output.push(path)
		return
	}
	const entries = await readdir(path, { withFileTypes: true })
	for (const entry of entries) {
		if (entry.isDirectory() || entry.isFile()) {
			await collectFiles(join(path, entry.name), output)
		}
	}
}

async function createSourceFingerprint() {
	const files = []
	for (const input of requiredInputs) {
		await collectFiles(join(packageRoot, input), files)
	}
	for (const input of workspaceInputs) {
		const path = join(packageRoot, input)
		if (await exists(path)) await collectFiles(path, files)
	}
	files.sort((left, right) =>
		relative(packageRoot, left).localeCompare(relative(packageRoot, right))
	)

	const fingerprint = createHash('sha256')
	for (const path of files) {
		const content = await readFile(path)
		fingerprint.update(relative(packageRoot, path))
		fingerprint.update('\0')
		fingerprint.update(createHash('sha256').update(content).digest('hex'))
		fingerprint.update('\0')
	}
	return fingerprint.digest('hex')
}

export async function writeSourceFingerprint() {
	await writeFile(fingerprintPath, `${await createSourceFingerprint()}\n`)
}

export async function isDistFresh() {
	for (const output of requiredOutputs) {
		if (!(await exists(join(packageRoot, output)))) return false
	}
	if (!(await exists(fingerprintPath))) return false
	const recorded = (await readFile(fingerprintPath, 'utf8')).trim()
	return recorded === (await createSourceFingerprint())
}
