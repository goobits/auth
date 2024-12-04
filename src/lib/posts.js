import { compile } from 'mdsvex'
import { join } from 'path'
import { readdirSync, readFileSync } from 'fs'
import { remarkTableOfContents } from '@lib/remarkTableOfContents.js'

const POSTS_PATH = join(process.cwd(), 'static/journal')

export async function getJournalPosts() {
	const posts = []
	const years = readdirSync(POSTS_PATH).filter(file => !file.startsWith('.'))

	for (const year of years) {
		const months = readdirSync(join(POSTS_PATH, year)).filter(file => !file.startsWith('.'))
		for (const month of months) {
			const postDirs = readdirSync(join(POSTS_PATH, year, month)).filter(file => !file.startsWith('.'))
			for (const postDir of postDirs) {
				try {
					const mdContent = readFileSync(join(POSTS_PATH, year, month, postDir, 'index.md'), 'utf-8')
					const compiled = await compile(mdContent)
					const cleanSlug = postDir.replace(/^\d{4}-\d{2}-\d{2}-/, '')

					// Extract date from frontmatter or filename
					let postDate
					if (compiled.data.date) {
						postDate = new Date(compiled.data.date)
					} else {
						const dateMatch = postDir.match(/^(\d{4})-(\d{2})-(\d{2})/)
						postDate = dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : new Date(`${year}-${month}-01`)
					}

					posts.push({
						year,
						month,
						slug: cleanSlug,
						urlPath: `journal/${year}/${month}/${cleanSlug}`,
						content: compiled.code,
						metadata: compiled.data,
						date: postDate
					})
				} catch (e) {
					throw new Error(`Failed to process ${postDir}: ${e.message}`)
				}
			}
		}
	}
	return posts.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export async function getPost({ year, month, slug }) {
	const monthPath = join(POSTS_PATH, year, month)
	try {
		const posts = readdirSync(monthPath).filter(dir => dir.endsWith(slug))
		if (posts.length === 0) return null

		const mdContent = readFileSync(join(monthPath, posts[0], 'index.md'), 'utf-8')
		const compiled = await compile(mdContent, {
			remarkPlugins: [ remarkTableOfContents ]
		})
		const strippedContent = compiled.code.replace(/{@html `(.*?)`}/gs, '$1')

		// Extract date same as above
		let postDate
		if (compiled.data.date) {
			postDate = new Date(compiled.data.date)
		} else {
			const dateMatch = posts[0].match(/^(\d{4})-(\d{2})-(\d{2})/)
			postDate = dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : new Date(`${year}-${month}-01`)
		}

		return {
			year,
			month,
			slug,
			content: strippedContent,
			metadata: compiled.data,
			date: postDate
		}
	} catch (e) {
		throw new Error(`Failed to find post: ${e.message}`)
	}
}