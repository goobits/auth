import { error } from '@sveltejs/kit'
import { getJournalPosts } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function entries() {
	const posts = await getJournalPosts()
	const tags = new Set()
	for (const post of posts) {
		for (const tag of post.metadata.fm.tags || []) {
			tags.add(tag)
		}
	}
	return [...tags].map(slug => ({ slug }))
}

export async function load({ params }) {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = allPosts.filter(post =>
		post.metadata.fm.tags?.includes(slug)
	)

	if (!posts.length) throw error(404)
	return { posts, tag: slug }
}
