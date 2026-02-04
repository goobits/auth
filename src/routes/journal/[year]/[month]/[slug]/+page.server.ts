import { error } from '@sveltejs/kit'
import { getPost, getJournalPosts } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function entries() {
	const posts = await getJournalPosts()
	return (posts as any[]).map(post => ({
		year: post.year,
		month: post.month,
		slug: post.slug
	}))
}

export async function load({ params }: { params: any }) {
	const { year, month, slug } = params
	if (!year || !month || !slug) throw error(404)
	const post = await getPost({ year, month, slug })
	if (!post) throw error(404)
	return { post }
}
