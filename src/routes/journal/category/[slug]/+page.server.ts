import { error } from '@sveltejs/kit'
import { getJournalPosts } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function entries() {
	const posts = await getJournalPosts()
	const categories = new Set<string>()
	for (const post of posts as any[]) {
		const fm = (post as any).metadata?.fm || {}
		for (const cat of (fm.categories || [])) {
			categories.add(cat)
		}
	}
	return [...categories].map(slug => ({ slug }))
}

export async function load({ params }: { params: any }) {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = (allPosts as any[]).filter(post =>
		(post as any).metadata?.fm?.categories?.includes(slug)
	)

	if (!posts.length) throw error(404)
	return { posts, category: slug }
}
