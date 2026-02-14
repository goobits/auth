<script>
	import { getAdminMe } from '$lib/client/api/adminClient'
	import { startCalendarOAuth } from '$lib/client/api/calendarClient'
	import { isCalendarConnectedFromParams, scheduleCalendarConnectedRedirect } from '$lib/client/routing/calendarState'

	let authUrl = ''
	let error = ''
	let status = ''
	let authed = false
	let authChecking = true
	let connected = false

	if (typeof window !== 'undefined') {
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
			error = err.message || 'Failed to start OAuth'
		}
	}
</script>

<svelte:head>
	<title>Calendar | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<section class="admin-calendar">
	<h2>Calendar Connection</h2>
	<p class="u-text-muted admin-calendar__muted">Connect Google Calendar to unlock booking availability.</p>
	{#if authChecking}
		<p class="u-text-muted admin-calendar__muted">Checking admin session...</p>
	{:else if !authed}
		<p class="u-text-error admin-calendar__error">Admin session required. Visit /admin to log in.</p>
	{:else}
		<button class="admin-calendar__connect" on:click={connect}>Connect Google Calendar</button>
	{/if}
	{#if status}
		<p class="admin-calendar__status">{status}</p>
	{/if}
	{#if error}
		<p class="u-text-error admin-calendar__error">{error}</p>
	{/if}

	<div class="admin-console__grid admin-calendar__grid">
		<div class="admin-console__card-surface admin-calendar__card">
			<h3>Live Status</h3>
			<p>{connected ? 'Connected to Google Calendar.' : 'Not connected yet.'}</p>
		</div>
		<div class="admin-console__card-surface admin-calendar__card">
			<h3>Redirects</h3>
			<p class="u-text-muted admin-calendar__muted">After connecting, you’ll land in Rainbow Gym to test bookings.</p>
		</div>
	</div>
</section>
