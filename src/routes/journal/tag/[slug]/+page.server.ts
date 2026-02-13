import { error } from '@sveltejs/kit'
import { getJournalPosts, type JournalPost } from '$lib/posts'
import type { EntryGenerator, PageServerLoad } from './$types'

export const prerender = true
export const trailingSlash = 'always'

export const entries: EntryGenerator = async () => {
	const posts = await getJournalPosts()
	const tags = new Set<string>()
	for (const post of posts) {
		const fm = post.metadata?.fm
		const tagsList = Array.isArray(fm?.tags) ? fm.tags : []
		for (const tag of tagsList) {
			tags.add(tag)
		}
	}
	return [...tags].map(slug => ({ slug }))
}

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = allPosts.filter((post: JournalPost) => {
		const tagsList = post.metadata?.fm?.tags
		return Array.isArray(tagsList) && tagsList.includes(slug)
	}
	)

	if (!posts.length) throw error(404)
	return { posts, tag: slug }
}
