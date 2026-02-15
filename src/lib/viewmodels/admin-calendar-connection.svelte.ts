import { getAdminMe } from '$lib/client/api/adminClient'
import { startCalendarOAuth } from '$lib/client/api/calendarClient'
import { isCalendarConnectedFromParams, scheduleCalendarConnectedRedirect } from '$lib/client/routing/calendarState'

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
			authed = !!data.authenticated
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
			authUrl = data.authUrl
			window.location.href = authUrl
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start OAuth'
		}
	}

	function init() {
		if (typeof window === 'undefined') return
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams(window.location.search)
		if (isCalendarConnectedFromParams(params)) {
			status = 'Connected! Redirecting you to Rainbow Gym...'
			connected = true
			scheduleCalendarConnectedRedirect(() => {
				window.location.href = '/calendar-gym'
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
