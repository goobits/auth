import { getAdminMe } from '$lib/client/api/adminClient'
import { startCalendarOAuth } from '$lib/client/api/calendarClient'
import { isCalendarConnectedFromParams, scheduleCalendarConnectedRedirect } from '$lib/client/routing/calendarState'
import { SvelteURLSearchParams } from 'svelte/reactivity'

function hasAuthenticatedFlag(value: unknown): value is { authenticated?: unknown } {
	return typeof value === 'object' && value !== null && 'authenticated' in value
}

function hasAuthUrl(value: unknown): value is { authUrl: string } {
	if (typeof value !== 'object' || value === null || !('authUrl' in value)) return false
	const authUrl = (value as { authUrl?: unknown }).authUrl
	return typeof authUrl === 'string' && authUrl.length > 0
}

export function createAdminCalendarConnectionController() {
	let authUrl = $state('')
	let error = $state('')
	let status = $state('')
	let authed = $state(false)
	let authChecking = $state(true)
	let connected = $state(false)

	async function checkAuth() {
		authChecking = true
		try {
			const data = await getAdminMe()
			authed = hasAuthenticatedFlag(data) ? Boolean(data.authenticated) : false
		} catch {
			authed = false
		} finally {
			authChecking = false
		}
	}

	async function connect() {
		status = ''
		error = ''
		try {
			if (!authed) {
				throw new Error('Admin session required. Please log in at /admin.')
			}
			const data = await startCalendarOAuth()
			if (!hasAuthUrl(data)) {
				throw new Error('OAuth start response missing auth URL.')
			}
			authUrl = data.authUrl
			window.location.href = authUrl
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start OAuth'
		}
	}

	function init() {
		if (typeof window === 'undefined') return
		const params = new SvelteURLSearchParams(window.location.search)
		if (isCalendarConnectedFromParams(params)) {
			status = 'Connected! Redirecting you to calendar...'
			connected = true
			scheduleCalendarConnectedRedirect(() => {
				window.location.href = '/calendar'
			})
		}
		checkAuth()
	}

	return {
		get authUrl() { return authUrl },
		get error() { return error },
		get status() { return status },
		get authed() { return authed },
		get authChecking() { return authChecking },
		get connected() { return connected },
		checkAuth,
		connect,
		init
	}
}
