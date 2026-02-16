<script>
	import { AlertTriangle, ChevronRight, RefreshCw } from '@lucide/svelte'

	const { dashboard } = $props()
	const needsCalendarAttention = $derived(dashboard.connectionExpired || !dashboard.connected)
</script>

<h1 class="admin-page__title">Overview</h1>
<p class="admin-page__subtitle">A snapshot of booking and calendar health.</p>

<div class="admin-page__stats">
	<div class="admin-page__stat-card">
		<div class="admin-page__stat-value">{dashboard.stats.upcoming}</div>
		<div class="admin-page__stat-label">Upcoming bookings</div>
	</div>
	<div class="admin-page__stat-card">
		<div class="admin-page__stat-value">{dashboard.stats.seats}</div>
		<div class="admin-page__stat-label">Seats reserved</div>
	</div>
	<div class="admin-page__stat-card">
		<div
			class="admin-page__stat-value"
			class:admin-page__stat-value--synced={dashboard.connected && !dashboard.connectionExpired}
			class:admin-page__stat-value--danger={dashboard.connected && dashboard.connectionExpired}
			class:admin-page__stat-value--muted={!dashboard.connected}
		>
			{#if dashboard.connected && !dashboard.connectionExpired}Synced{:else if dashboard.connected && dashboard.connectionExpired}Expired{:else}Offline{/if}
		</div>
		<div class="admin-page__stat-label">Google Calendar</div>
	</div>
</div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Needs attention</h3>
	</div>
	{#if needsCalendarAttention}
		<div class="admin-page__attention-card">
			<div class="admin-page__attention-main">
				<AlertTriangle size={14} />
				<span>{dashboard.connectionExpired ? 'Google Calendar token expired' : 'Google Calendar is not connected'}</span>
			</div>
			<button class="admin-page__button-secondary admin-page__button-secondary--compact" onclick={dashboard.reconnect}>
				<RefreshCw size={12} />
				Reconnect
			</button>
		</div>
	{:else}
		<p class="admin-page__section-description">No urgent issues right now.</p>
	{/if}
</div>

<div class="admin-page__divider" aria-hidden="true"></div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Recent bookings</h3>
		<span class="admin-page__section-count">{dashboard.bookings.length} total</span>
	</div>
	{#if dashboard.loading}
		<p class="admin-page__section-description">Loading bookings...</p>
	{:else if dashboard.error}
		<p class="admin-page__section-description admin-page__section-description--error">{dashboard.error}</p>
		<button class="admin-page__button-secondary" onclick={dashboard.loadBookings}>Retry</button>
	{:else if dashboard.bookings.length === 0}
		<p class="admin-page__section-description">No upcoming bookings yet.</p>
	{:else}
		<div class="admin-page__bookings-list">
			{#each dashboard.bookings as b, i}
				<button
					class="admin-page__booking-row"
					class:admin-page__booking-row--hovered={dashboard.hover === b.id}
					onmouseenter={() => dashboard.hover = b.id}
					onmouseleave={() => dashboard.hover = null}
					onclick={() => dashboard.viewBooking = b}
				>
					<span class="admin-page__booking-date">{b.date} · {b.time}</span>
					<span class="admin-page__booking-meta">{b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.name}</span>
					<span class="admin-page__status-badge" class:admin-page__status-badge--confirmed={b.status === 'confirmed'} class:admin-page__status-badge--pending={b.status === 'pending'}>
						{b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
					</span>
					<ChevronRight class="admin-page__booking-arrow" size={14} />
				</button>
				{#if i < dashboard.bookings.length - 1}
					<div class="admin-page__booking-divider"></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
