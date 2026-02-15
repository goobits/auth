import type { PageLoad } from './$types'

export const prerender = false

export const load: PageLoad = ({ url }) => {
	return {
		contextFrom: url.searchParams.get('from')?.trim() || '',
		contextTopic: url.searchParams.get('topic')?.trim() || ''
	}
}

