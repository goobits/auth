import { getJournalPosts } from '$lib/posts'

type MusicPost = {
	title: string
	urlPath: string
	date: string
}

export async function load() {
	const posts = await getJournalPosts()

	const musicPosts: MusicPost[] = posts
		.filter(post => {
			const categories = post?.metadata?.fm?.categories
			if (!Array.isArray(categories)) return false
			return categories.some(category => String(category).toLowerCase() === 'music')
		})
		.slice(0, 12)
		.map(post => ({
			title: String(post?.metadata?.fm?.title || post.slug),
			urlPath: String(post.urlPath),
			date: post.date.toISOString()
		}))

	return {
		musicPosts
	}
}
