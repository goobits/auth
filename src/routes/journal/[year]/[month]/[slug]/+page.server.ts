import { error } from '@sveltejs/kit'
import { getPost, getJournalPosts } from '$lib/posts'
import type { EntryGenerator, PageServerLoad } from './$types'

export const prerender = true
export const trailingSlash = 'always'

export const entries: EntryGenerator = async () => {
	const posts = await getJournalPosts()
	return posts.map(post => ({
		year: post.year,
		month: post.month,
		slug: post.slug
	}))
}

export const load: PageServerLoad = async ({ params }) => {
	const { year, month, slug } = params
	if (!year || !month || !slug) throw error(404)
	const post = await getPost({ year, month, slug })
	if (!post) throw error(404)
	return { post }
}
