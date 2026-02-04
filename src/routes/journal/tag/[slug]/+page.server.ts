import { error } from '@sveltejs/kit'
import { getJournalPosts } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function entries() {
	const posts = await getJournalPosts()
	const tags = new Set<string>()
	for (const post of posts as any[]) {
		const fm = (post as any).metadata?.fm || {}
		for (const tag of (fm.tags || [])) {
			tags.add(tag)
		}
	}
	return [...tags].map(slug => ({ slug }))
}

export async function load({ params }: { params: any }) {
	const { slug } = params
	if (!slug) throw error(404)

	const allPosts = await getJournalPosts()
	const posts = (allPosts as any[]).filter(post =>
		(post as any).metadata?.fm?.tags?.includes(slug)
	)

	if (!posts.length) throw error(404)
	return { posts, tag: slug }
}
