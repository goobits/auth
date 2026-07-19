import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeSourceFingerprint } from './sourceFingerprint.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const runtimeDirs = [join(root, 'dist', 'node'), join(root, 'dist', 'worker')]
const assetDirs = [...runtimeDirs, join(root, 'dist', 'types')]

function rewriteRelativeTypeScriptImports(source) {
	return source.replace(/(['"])([.][.]?\/[^'"]+)\.ts\1/g, '$1$2.js$1')
}

async function copyUiAssets() {
	const sourceDir = join(root, 'src', 'ui')
	const entries = await readdir(sourceDir, { withFileTypes: true })

	for (const outputDir of assetDirs) {
		await mkdir(join(outputDir, 'ui'), { recursive: true })
	}

	for (const entry of entries) {
		if (!entry.isFile() || !['.svelte', '.css'].includes(extname(entry.name))) {
			continue
		}

		const sourcePath = join(sourceDir, entry.name)
		for (const outputDir of assetDirs) {
			const outputPath = join(outputDir, 'ui', entry.name)
			if (extname(entry.name) === '.svelte') {
				const source = await readFile(sourcePath, 'utf8')
				await writeFile(outputPath, rewriteRelativeTypeScriptImports(source))
			} else {
				await copyFile(sourcePath, outputPath)
			}
		}
	}
}

async function writeRuntimeUiBarrels() {
	const source = await readFile(join(root, 'src', 'ui', 'index.ts'), 'utf8')
	const barrel = rewriteRelativeTypeScriptImports(source).replace(/^export type .*;\n/gm, '')

	for (const outputDir of runtimeDirs) {
		await writeFile(join(outputDir, 'ui', 'index.js'), barrel)
	}
}

async function copyRuntimeDeclarations(subpath) {
	const sourceDir = join(root, 'dist', 'types', subpath)
	for (const outputDir of runtimeDirs) {
		await cp(sourceDir, join(outputDir, subpath), { recursive: true })
	}
}

async function rewriteDeclarations(directory) {
	const entries = await readdir(directory, { withFileTypes: true })
	for (const entry of entries) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			await rewriteDeclarations(path)
		} else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
			const source = await readFile(path, 'utf8')
			const rewritten = rewriteRelativeTypeScriptImports(source)
			if (rewritten !== source) {
				await writeFile(path, rewritten)
			}
		}
	}
}

await copyUiAssets()
await writeRuntimeUiBarrels()
await rewriteDeclarations(join(root, 'dist', 'types'))
// Published Svelte sources resolve types beside their runtime imports.
for (const subpath of ['client', 'qr']) {
	await copyRuntimeDeclarations(subpath)
}
await writeSourceFingerprint()
