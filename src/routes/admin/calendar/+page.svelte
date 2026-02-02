<script>
	let authUrl = ''
	let error = ''
	let status = ''
	let passcode = ''
	let connected = false

	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search)
		if (params.get('connected') === '1') {
			status = 'Connected! Redirecting you to Rainbow Gym...'
			connected = true
			setTimeout(() => {
				window.location.href = '/rainbow-gym'
			}, 1200)
		}
		const stored = window.localStorage.getItem('admin-passcode') || ''
		passcode = stored
		if (!stored && import.meta.env.DEV && import.meta.env.VITE_ADMIN_PASSCODE) {
			passcode = import.meta.env.VITE_ADMIN_PASSCODE
			window.localStorage.setItem('admin-passcode', passcode)
		}
	}

	async function connect() {
		status = ''
		error = ''
		try {
			if (passcode && typeof window !== 'undefined') {
				window.localStorage.setItem('admin-passcode', passcode)
			}
			const res = await fetch('/api/calendar/oauth-start', {
				headers: passcode ? { 'x-admin-code': passcode } : {}
			})
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
	<title>Admin Calendar - MIKO.ART</title>
</svelte:head>

<section>
	<h2>Calendar Connection</h2>
	<p class="muted">Connect Google Calendar to unlock booking availability.</p>
	<label>
		Passcode
		<input type="password" bind:value={passcode} placeholder="Admin passcode" />
	</label>
	<button on:click={connect}>Connect Google Calendar</button>
	{#if status}
		<p>{status}</p>
	{/if}
	{#if error}
		<p class="error">{error}</p>
	{/if}

	<div class="admin-grid">
		<div class="card">
			<h3>Live Status</h3>
			<p>{connected ? 'Connected to Google Calendar.' : 'Not connected yet.'}</p>
		</div>
		<div class="card">
			<h3>Redirects</h3>
			<p class="muted">After connecting, you’ll land in Rainbow Gym to test bookings.</p>
		</div>
	</div>
</section>
