<script>
	import { onMount } from 'svelte'
	import { Clock, Calendar, Check, RefreshCw, Save, ChevronRight, Loader } from '@lucide/svelte'

	let tab = $state('dash')
	let hours = $state({ from: '06:00', to: '22:00' })
	let buffer = $state(15)
	let notice = $state(24)
	let capacity = $state(4)
	let saved = $state(false)
	let saving = $state(false)
	let canceling = $state(false)
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

	const adminCode = import.meta.env.VITE_ADMIN_PASSCODE || ''

	async function loadStatus() {
		try {
			const res = await fetch(`/api/admin/status?code=${adminCode}`)
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
			const res = await fetch(`/api/admin/bookings?code=${adminCode}`)
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

	async function save() {
		saving = true
		try {
			const res = await fetch(`/api/admin/rules?code=${adminCode}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hoursFrom: hours.from,
					hoursTo: hours.to,
					buffer,
					notice,
					capacity
				})
			})
			const data = await res.json()
			if (data.ok) {
				saved = true
				setTimeout(() => saved = false, 2200)
			} else {
				error = data.error?.message || 'Failed to save rules'
			}
		} catch (err) {
			error = err.message || 'Failed to save rules'
		} finally {
			saving = false
		}
	}

	async function cancelBooking(bookingId) {
		if (!confirm('Are you sure you want to cancel this booking?')) return
		canceling = true
		try {
			const res = await fetch(`/api/admin/cancel?code=${adminCode}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookingId })
			})
			const data = await res.json()
			if (data.ok) {
				viewBooking = null
				await loadBookings()
			} else {
				error = data.error?.message || 'Failed to cancel booking'
			}
		} catch (err) {
			error = err.message || 'Failed to cancel booking'
		} finally {
			canceling = false
		}
	}

	async function reconnect() {
		const res = await fetch(`/api/calendar/oauth-start?code=${adminCode}`)
		const data = await res.json()
		if (data.authUrl) {
			window.location.href = data.authUrl
		} else {
			console.error('Failed to start OAuth:', data.error)
			error = data.error?.message || 'Failed to connect to Google'
		}
	}

	onMount(() => {
		loadStatus()
		loadBookings()
	})
</script>

<svelte:head>
	<title>Admin - Rainbow Gym</title>
</svelte:head>

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
						<Clock size={16} strokeWidth={1.8} />
					{:else}
						<Calendar size={16} strokeWidth={1.8} />
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
								<Check size={14} strokeWidth={2.5} />
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
							<RefreshCw size={14} />
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
								<span class="field-label">Operating hours</span>
								<div class="time-row">
									<input type="time" bind:value={hours.from} aria-label="Opening time" />
									<span class="time-sep">to</span>
									<input type="time" bind:value={hours.to} aria-label="Closing time" />
								</div>
							</div>
						</div>
						<div class="fields-row">
							<div class="field">
								<label class="field-label">
									Buffer between slots
									<div class="input-wrap">
										<input type="number" min="0" bind:value={buffer} />
										<span class="input-suffix">min</span>
									</div>
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Minimum notice
									<div class="input-wrap">
										<input type="number" min="1" bind:value={notice} />
										<span class="input-suffix">hrs</span>
									</div>
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Capacity per slot
									<div class="input-wrap">
										<input type="number" min="1" bind:value={capacity} />
										<span class="input-suffix">people</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="btn-sec" onclick={save} disabled={saving}>
						{#if saving}
							<Loader size={12} class="spin" />
							Saving...
						{:else}
							<Save size={12} />
							Save rules
						{/if}
					</button>
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
									<ChevronRight class="booking-arrow" size={14} />
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
								<Check size={14} strokeWidth={2.5} />
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
							<RefreshCw size={14} />
							Reconnect
						</button>
					</div>
				</div>
			{/if}
		</main>
	</div>

	<!-- Booking detail modal -->
	{#if viewBooking}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={() => viewBooking = null} onkeydown={(e) => e.key === 'Escape' && (viewBooking = null)}>
			<div class="modal-card" role="document" onkeydown={() => {}} onclick={(e) => e.stopPropagation()}>
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
					<button class="btn-sec danger" onclick={() => cancelBooking(viewBooking.id)} disabled={canceling}>
						{#if canceling}
							<Loader size={12} class="spin" />
							Canceling...
						{:else}
							Cancel booking
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Save toast -->
	{#if saved}
		<div class="toast">
			<Check size={14} strokeWidth={2.5} />
			Rules saved successfully.
		</div>
	{/if}
