import { ApiClientError } from '$lib/client/api/http'

export function isCalendarLoginPath(pathname: string): boolean {
	return pathname === '/calendar/login' || pathname === '/calendar/login/'
}

export function buildCalendarLoginRedirect(pathname: string): string {
	return `/calendar/login?redirect=${encodeURIComponent(pathname)}`
}

export function shouldRedirectCalendarGuest(user: unknown, pathname: string): boolean {
	return !user && !isCalendarLoginPath(pathname)
}

export function handleUnauthorizedSessionError(error: unknown): boolean {
	if (error instanceof ApiClientError && error.status === 401) {
		window.location.reload()
		return true
	}
	return false
}
