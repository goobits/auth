<script>
	let authUrl = ''
	let error = ''
	let status = ''
	let authed = false
	let authChecking = true
	let connected = false

	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search)
		if (params.get('connected') === '1') {
			status = 'Connected! Redirecting you to Rainbow Gym...'
			connected = true
			setTimeout(() => {
				window.location.href = '/calendar-gym'
			}, 1200)
		}
		checkAuth()
	}

	async function checkAuth() {
		authChecking = true
		try {
			const res = await fetch('/api/admin/me')
			const data = await res.json()
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
			const res = await fetch('/api/calendar/oauth-start')
			const data = await res.json()
			if (!res.ok) throw new Error(data.error?.message || 'Failed to start OAuth')
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
	<p class="muted admin-calendar__muted">Connect Google Calendar to unlock booking availability.</p>
	{#if authChecking}
		<p class="muted admin-calendar__muted">Checking admin session...</p>
	{:else if !authed}
		<p class="error admin-calendar__error">Admin session required. Visit /admin to log in.</p>
	{:else}
		<button class="admin-calendar__connect" on:click={connect}>Connect Google Calendar</button>
	{/if}
	{#if status}
		<p class="admin-calendar__status">{status}</p>
	{/if}
	{#if error}
		<p class="error admin-calendar__error">{error}</p>
	{/if}

	<div class="admin-grid admin-calendar__grid">
		<div class="card admin-calendar__card">
			<h3>Live Status</h3>
			<p>{connected ? 'Connected to Google Calendar.' : 'Not connected yet.'}</p>
		</div>
		<div class="card admin-calendar__card">
			<h3>Redirects</h3>
			<p class="muted admin-calendar__muted">After connecting, you’ll land in Rainbow Gym to test bookings.</p>
		</div>
	</div>
</section>
