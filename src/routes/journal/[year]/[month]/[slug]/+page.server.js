import { error } from '@sveltejs/kit'
import { getPost } from '$lib/posts'

export const prerender = true
export const trailingSlash = 'always'

export async function load({ params }) {
	const { year, month, slug } = params
	if (!year || !month || !slug) throw error(404)
	const post = await getPost({ year, month, slug })
	if (!post) throw error(404)
	return { post }
}