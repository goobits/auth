<script>
	import { onMount } from 'svelte'
	import './Admin.scss'

	let tab = $state('dash')
	let hours = $state({ from: '06:00', to: '22:00' })
	let buffer = $state(15)
	let notice = $state(24)
	let capacity = $state(4)
	let saved = $state(false)
	let viewBooking = $state(null)
	let hover = $state(null)
	let connected = $state(false)
	let connectionExpired = $state(false)
	let bookings = $state([])
	let stats = $state({ upcoming: 0, seats: 0 })
	let loading = $state(true)
	let error = $state('')

	const NAV = [
		{ label: 'Dashboard', id: 'dash' },
		{ label: 'Calendar', id: 'cal' }
	]

	async function loadStatus() {
		try {
			const res = await fetch('/api/admin/status')
			const data = await res.json()
			if (data.ok) {
				connected = data.google?.connected ?? false
				connectionExpired = data.google?.expired ?? false
				if (data.rules) {
					hours = { from: data.rules.hoursFrom, to: data.rules.hoursTo }
					buffer = data.rules.buffer
					notice = data.rules.notice
					capacity = data.rules.capacity
				}
			}
		} catch (err) {
			console.error('Failed to load status:', err)
		}
	}

	async function loadBookings() {
		loading = true
		error = ''
		try {
			const res = await fetch('/api/admin/bookings')
			const data = await res.json()
			if (data.ok) {
				bookings = data.bookings || []
				stats = data.stats || { upcoming: 0, seats: 0 }
			} else {
				error = data.error?.message || 'Failed to load bookings'
			}
		} catch (err) {
			error = err.message || 'Failed to load bookings'
		} finally {
			loading = false
		}
	}

	function save() {
		// TODO: Save rules to API when endpoint is ready
		saved = true
		setTimeout(() => saved = false, 2200)
	}

	async function reconnect() {
		window.location.href = '/api/calendar/oauth-start'
	}

	onMount(() => {
		loadStatus()
		loadBookings()
	})
</script>

<svelte:head>
	<title>Admin - Rainbow Gym</title>
</svelte:head>

<div class="admin-root">
	<div class="admin-shell">
		<!-- Sidebar -->
		<aside class="sidebar">
			<div class="side-title">Manage</div>
			{#each NAV as n}
				<button
					class="side-item"
					class:active={tab === n.id}
					onclick={() => tab = n.id}
				>
					{#if n.id === 'dash'}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
					{/if}
					{n.label}
				</button>
			{/each}
		</aside>

		<!-- Content -->
		<main class="admin-main">
			{#if tab === 'dash'}
				<h1 class="page-title">Dashboard</h1>
				<p class="page-sub">Everything about your gym, at a glance.</p>

				<!-- Stats row -->
				<div class="stats-row">
					<div class="stat-card">
						<div class="stat-val">{stats.upcoming}</div>
						<div class="stat-label">Upcoming bookings</div>
					</div>
					<div class="stat-card">
						<div class="stat-val">{stats.seats}</div>
						<div class="stat-label">Seats reserved</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" class:synced={connected && !connectionExpired}>
							{#if connected && !connectionExpired}Synced{:else if connected && connectionExpired}Expired{:else}Offline{/if}
						</div>
						<div class="stat-label">Google Calendar</div>
					</div>
				</div>

				<!-- Calendar connection -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Google Calendar</h3>
						<span class="badge" class:connected={connected && !connectionExpired}>
							{#if connected && !connectionExpired}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
								Connected
							{:else if connected && connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="section-desc">Availability and bookings stay in sync with your Google Calendar — automatically.</p>
					<div class="btn-row">
						<button class="btn-sec" onclick={reconnect}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 18.8-4.3"/><path d="M21.5 12.5a10 10 0 0 1-18.8 4.2"/></svg>
							{connected ? 'Reconnect' : 'Connect'}
						</button>
					</div>
				</div>

				<!-- Availability -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Availability rules</h3>
					</div>
					<p class="section-desc">Define when friends can book, and how much runway you need between sessions.</p>
					<div class="fields-grid">
						<div class="fields-row">
							<div class="field">
								<label class="field-label">Operating hours</label>
								<div class="time-row">
									<input type="time" bind:value={hours.from} />
									<span class="time-sep">to</span>
									<input type="time" bind:value={hours.to} />
								</div>
							</div>
						</div>
						<div class="fields-row">
							<div class="field">
								<label class="field-label">Buffer between slots</label>
								<div class="input-wrap">
									<input type="number" min="0" bind:value={buffer} />
									<span class="input-suffix">min</span>
								</div>
							</div>
							<div class="field">
								<label class="field-label">Minimum notice</label>
								<div class="input-wrap">
									<input type="number" min="1" bind:value={notice} />
									<span class="input-suffix">hrs</span>
								</div>
							</div>
							<div class="field">
								<label class="field-label">Capacity per slot</label>
								<div class="input-wrap">
									<input type="number" min="1" bind:value={capacity} />
									<span class="input-suffix">people</span>
								</div>
							</div>
						</div>
					</div>
					<button class="btn-pri" onclick={save}>Save rules</button>
				</div>

				<!-- Bookings -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Recent bookings</h3>
						<span class="section-count">{bookings.length} total</span>
					</div>
					{#if loading}
						<p class="section-desc">Loading bookings...</p>
					{:else if error}
						<p class="section-desc" style="color: var(--form-error)">{error}</p>
						<button class="btn-sec" onclick={loadBookings}>Retry</button>
					{:else if bookings.length === 0}
						<p class="section-desc">No upcoming bookings yet.</p>
					{:else}
						<div class="bookings-list">
							{#each bookings as b, i}
								<button
									class="booking-row"
									class:hovered={hover === b.id}
									onmouseenter={() => hover = b.id}
									onmouseleave={() => hover = null}
									onclick={() => viewBooking = b}
								>
									<span class="booking-date">{b.date} · {b.time}</span>
									<span class="booking-meta">{b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.name}</span>
									<span class="badge" class:confirmed={b.status === 'confirmed'} class:pending={b.status === 'pending'}>
										{b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
									</span>
									<svg class="booking-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
								</button>
								{#if i < bookings.length - 1}
									<div class="booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if tab === 'cal'}
				<h1 class="page-title">Calendar</h1>
				<p class="page-sub">Manage your Google Calendar connection and sync preferences.</p>
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Google Calendar</h3>
						<span class="badge" class:connected={connected && !connectionExpired}>
							{#if connected && !connectionExpired}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
								Connected
							{:else if connected && connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="section-desc">Your bookings automatically appear on your calendar. Blocked times on your calendar automatically remove availability from clients.</p>
					<div class="btn-row">
						<button class="btn-sec" onclick={reconnect}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 18.8-4.3"/><path d="M21.5 12.5a10 10 0 0 1-18.8 4.2"/></svg>
							Reconnect
						</button>
					</div>
				</div>
			{/if}
		</main>
	</div>

	<!-- Booking detail modal -->
	{#if viewBooking}
		<div class="modal-overlay" onclick={() => viewBooking = null}>
			<div class="modal-card" onclick={(e) => e.stopPropagation()}>
				<h3 class="modal-title">Booking details</h3>
				<p class="modal-sub">Here's what we have on file.</p>
				<div class="modal-rows">
					<div class="modal-row">
						<span class="modal-label">Date</span>
						<span class="modal-val">{viewBooking.date}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Time</span>
						<span class="modal-val">{viewBooking.time}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Guest</span>
						<span class="modal-val">{viewBooking.name}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Email</span>
						<span class="modal-val">{viewBooking.email}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Seats</span>
						<span class="modal-val">{viewBooking.seats}</span>
					</div>
					{#if viewBooking.note}
						<div class="modal-row">
							<span class="modal-label">Note</span>
							<span class="modal-val">{viewBooking.note}</span>
						</div>
					{/if}
					<div class="modal-row">
						<span class="modal-label">Status</span>
						<span class="modal-val">{viewBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
					</div>
				</div>
				<div class="modal-actions">
					<button class="btn-pri" onclick={() => viewBooking = null}>Done</button>
					<button class="btn-sec danger">Cancel booking</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Save toast -->
	{#if saved}
		<div class="toast">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
			Rules saved successfully.
		</div>
	{/if}
</div>
