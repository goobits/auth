import { compile } from 'mdsvex'
import { join } from 'path'
import { readdirSync, readFileSync } from 'fs'
import { remarkTableOfContents } from '@lib/remarkTableOfContents.ts'

const POSTS_PATH = join(process.cwd(), 'static/journal')

type Frontmatter = Record<string, unknown> & {
	date?: string | Date
}

type MdsvexCompileResult = {
	code?: string
	data?: Frontmatter
}

export type JournalPost = {
	year: string
	month: string
	slug: string
	urlPath: string
	content: string
	metadata: Frontmatter
	date: Date
}

function resolvePostDate(value: unknown, fallback: () => Date): Date {
	if (value instanceof Date) return value
	if (typeof value === 'string') {
		const parsed = new Date(value)
		if (!Number.isNaN(parsed.getTime())) return parsed
	}
	return fallback()
}

export async function getJournalPosts() {
	const posts: JournalPost[] = []
	const years = readdirSync(POSTS_PATH).filter(file => !file.startsWith('.'))

	for (const year of years) {
		const months = readdirSync(join(POSTS_PATH, year)).filter(file => !file.startsWith('.'))
		for (const month of months) {
			const postDirs = readdirSync(join(POSTS_PATH, year, month)).filter(file => !file.startsWith('.'))
			for (const postDir of postDirs) {
				try {
					const mdContent = readFileSync(join(POSTS_PATH, year, month, postDir, 'index.md'), 'utf-8')
					const compiled = (await compile(mdContent)) as MdsvexCompileResult
					const cleanSlug = postDir.replace(/^\d{4}-\d{2}-\d{2}-/, '')

					// Extract date from frontmatter or filename
					const dateMatch = postDir.match(/^(\d{4})-(\d{2})-(\d{2})/)
					const fallbackDate = () =>
						dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : new Date(`${year}-${month}-01`)
					const postDate = resolvePostDate(compiled?.data?.date, fallbackDate)

					posts.push({
						year,
						month,
						slug: cleanSlug,
						urlPath: `journal/${year}/${month}/${cleanSlug}`,
						content: compiled?.code ?? '',
						metadata: compiled?.data ?? {},
						date: postDate
					})
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : String(error)
					throw new Error(`Failed to process ${postDir}: ${message}`)
				}
			}
		}
	}
	return posts.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export async function getPost({
	year,
	month,
	slug
}: {
	year: string
	month: string
	slug: string
}): Promise<JournalPost | null> {
	const monthPath = join(POSTS_PATH, year, month)
	try {
		const posts = readdirSync(monthPath).filter(dir => dir.endsWith(slug))
		if (posts.length === 0) return null

		const mdContent = readFileSync(join(monthPath, posts[0], 'index.md'), 'utf-8')
		const compiled = (await compile(mdContent, {
			remarkPlugins: [ remarkTableOfContents ]
		})) as MdsvexCompileResult
		const strippedContent = (compiled?.code ?? '').replace(/{@html `(.*?)`}/gs, '$1')

		// Extract date same as above
		const dateMatch = posts[0].match(/^(\d{4})-(\d{2})-(\d{2})/)
		const fallbackDate = () =>
			dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : new Date(`${year}-${month}-01`)
		const postDate = resolvePostDate(compiled?.data?.date, fallbackDate)

		return {
			year,
			month,
			slug,
			content: strippedContent,
			metadata: compiled?.data ?? {},
			date: postDate
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to find post: ${message}`)
	}
}
