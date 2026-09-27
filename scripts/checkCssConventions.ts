import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const packageRoot = new URL('..', import.meta.url)
const sourceRoot = new URL('src/', packageRoot)
const bemClass =
	/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?(?:--[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?$/
const classSelector = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g
const failures: string[] = []

for (const filePath of await collectStyleFiles(sourceRoot)) {
	const source = await readFile(filePath, 'utf8')
	const styles = (filePath.endsWith('.svelte') ? extractStyleBlocks(source) : source).replace(
		/\/\*[\s\S]*?\*\//g,
		''
	)
	const classes = new Set(
		[...styles.matchAll(classSelector)].flatMap((match) => (match[1] ? [match[1]] : []))
	)
	const blocks = new Set<string>()
	for (const className of classes) {
		if (!bemClass.test(className)) {
			failures.push(`${filePath.replace(packageRoot.pathname, '')}: .${className} is not BEM`)
			continue
		}
		blocks.add(className.split(/__|--/, 1)[0]!)
	}
	if (filePath.endsWith('.svelte') && blocks.size > 2) {
		failures.push(
			`${filePath.replace(packageRoot.pathname, '')}: owns ${blocks.size} BEM blocks; expected at most 2`
		)
	}
}

if (failures.length > 0) {
	console.error('CSS convention check failed:')
	for (const failure of failures) console.error(`- ${failure}`)
	process.exitCode = 1
} else {
	console.log('CSS conventions passed: Auth selectors use focused BEM blocks.')
}

function extractStyleBlocks(source: string): string {
	return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
		.map((match) => match[1])
		.join('\n')
}

async function collectStyleFiles(directoryUrl: URL): Promise<string[]> {
	const entries = await readdir(directoryUrl, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl)
		if (entry.isDirectory()) files.push(...(await collectStyleFiles(entryUrl)))
		else if (entry.name.endsWith('.css') || entry.name.endsWith('.svelte')) {
			files.push(join(directoryUrl.pathname, entry.name))
		}
	}
	return files
}
