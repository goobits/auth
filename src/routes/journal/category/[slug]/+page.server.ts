import { error } from '@sveltejs/kit'
import { getJournalPosts, type JournalPost } from '$lib/posts'
import type { EntryGenerator, PageServerLoad } from './$types'

export const prerender = true
export const trailingSlash = 'always'

export const entries: EntryGenerator = async () => {
	const posts = await getJournalPosts()
	const categories = new Set<string>()
	for (const post of posts) {
		const fm = post.metadata?.fm
		const categoryList = Array.isArray(fm?.categories) ? fm.categories : []
		for (const cat of categoryList) {
			categories.add(cat)
		}
	}
	return [...categories].map(slug => ({ slug }))
}

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = allPosts.filter((post: JournalPost) => {
		const categoryList = post.metadata?.fm?.categories
		return Array.isArray(categoryList) && categoryList.includes(slug)
	}
	)

	if (!posts.length) throw error(404)
	return { posts, category: slug }
}
