import { join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'

type LabsJournalDates = {
	datesByHref: Record<string, string>
}

const POSTS_PATH = join(process.cwd(), 'static/journal')

function isDirectoryName(name: string) {
	return Boolean(name) && !name.startsWith('.')
}

function parseFrontmatterDate(md: string): string | null {
	// Fast-path YAML frontmatter date parse; avoids pulling in a YAML parser.
	// Expected shape:
	// ---
	// date: "2010-08-07"
	// ---
	const match = md.match(/^---\s*\n[\s\S]*?\ndate:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*\n[\s\S]*?\n---\s*\n/m)
	return match?.[1] ?? null
}

function canonicalizeHref(href: string): string {
	if (!href.startsWith('/')) return href
	if (href.endsWith('/')) return href
	// Keep file paths like *.html as-is.
	if (/\.[a-z0-9]+$/i.test(href)) return href
	return `${href}/`
}

function extractLocalLinks(md: string): string[] {
	// Extract target urls from markdown link/image syntax: [text](url) and ![](url)
	const out: string[] = []
	const re = /\((\/[^)\s]+)\)/g
	for (const match of md.matchAll(re)) {
		const url = match[1]
		if (!url) continue
		out.push(url)
	}
	return out
}

export function getLabsJournalDates(): LabsJournalDates {
	const datesByHref: Record<string, string> = {}

	const years = readdirSync(POSTS_PATH).filter(isDirectoryName)
	for (const year of years) {
		const months = readdirSync(join(POSTS_PATH, year)).filter(isDirectoryName)
		for (const month of months) {
			const postDirs = readdirSync(join(POSTS_PATH, year, month)).filter(isDirectoryName)
			for (const postDir of postDirs) {
				const mdPath = join(POSTS_PATH, year, month, postDir, 'index.md')
				let md = ''
				try {
					md = readFileSync(mdPath, 'utf-8')
				} catch {
					continue
				}

				const fmDate = parseFrontmatterDate(md) ?? `${year}-${month}-01`
				const links = extractLocalLinks(md)
				for (const rawHref of links) {
					// Cross-reference labs and a few legacy root aliases.
					let href = rawHref
					if (href === '/midi-js/' || href === '/midi-js') href = '/labs/midi-js/'
					if (!href.startsWith('/labs/')) continue

					const canonical = canonicalizeHref(href)
					const prev = datesByHref[canonical]
					// Keep earliest mention as "created/first published".
					if (!prev || fmDate < prev) datesByHref[canonical] = fmDate
				}
			}
		}
	}

	return { datesByHref }
}

