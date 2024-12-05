import { error } from '@sveltejs/kit'
import { getJournalPosts } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function load({ params }) {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = allPosts.filter(post =>
		post.metadata.fm.categories?.includes(slug)
	)

	if (!posts.length) throw error(404)
	return { posts, category: slug }
}