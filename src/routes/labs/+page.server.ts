import type { PageServerLoad } from './$types'
import { getLabsJournalDates } from '$lib/server/labs-journal-dates'

export const prerender = true
export const trailingSlash = 'always'

export const load: PageServerLoad = async () => {
	const { datesByHref } = getLabsJournalDates()
	return { datesByHref }
}

