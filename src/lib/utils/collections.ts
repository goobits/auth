export function normalizeQuery(value: string) {
	return value.trim().toLowerCase()
}

export function matchesQuery(query: string, values: Array<string | null | undefined>) {
	if (!query) return true
	return values.some((value) => (value || '').toLowerCase().includes(query))
}

export function localeSort(a: string, b: string) {
	return a.localeCompare(b)
}

export function slugify(value: string) {
	return value.toLowerCase().replace(/\s+/g, '-')
}
