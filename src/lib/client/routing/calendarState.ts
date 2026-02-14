export function isCalendarConnectedFromParams(search: URLSearchParams): boolean {
	return search.get('connected') === '1'
}

export function scheduleCalendarConnectedRedirect(
	onRedirect: () => void,
	delayMs = 1200
): number {
	return window.setTimeout(onRedirect, delayMs)
}
