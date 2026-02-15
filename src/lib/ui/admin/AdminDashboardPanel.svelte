<script>
	import { Check, RefreshCw, Save, Loader, ChevronRight } from '@lucide/svelte'
	const { dashboard } = $props()
</script>

<h1 class="admin-page__title">Dashboard</h1>
<p class="admin-page__subtitle">Everything about your gym, at a glance.</p>

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
		<div class="admin-page__stat-value" class:admin-page__stat-value--synced={dashboard.connected && !dashboard.connectionExpired}>
			{#if dashboard.connected && !dashboard.connectionExpired}Synced{:else if dashboard.connected && dashboard.connectionExpired}Expired{:else}Offline{/if}
		</div>
		<div class="admin-page__stat-label">Google Calendar</div>
	</div>
</div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Google Calendar</h3>
		<span class="admin-page__status-badge" class:admin-page__status-badge--connected={dashboard.connected && !dashboard.connectionExpired}>
			{#if dashboard.connected && !dashboard.connectionExpired}
				<Check size={14} strokeWidth={2.5} />
				Connected
			{:else if dashboard.connected && dashboard.connectionExpired}
				Token expired
			{:else}
				Not connected
			{/if}
		</span>
	</div>
	<p class="admin-page__section-description">Availability and bookings stay in sync with your Google Calendar — automatically.</p>
	<div class="admin-page__button-row">
		<button class="admin-page__button-secondary" onclick={dashboard.reconnect}>
			<RefreshCw size={14} />
			{dashboard.connected ? 'Reconnect' : 'Connect'}
		</button>
	</div>
</div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Availability rules</h3>
	</div>
	<p class="admin-page__section-description">Define when friends can book, and how much runway you need between sessions.</p>
	<div class="admin-page__fields-grid">
		<div class="admin-page__fields-row">
			<div class="admin-page__field">
				<span class="admin-page__field-label">Operating hours</span>
				<div class="admin-page__time-row">
					<input class="admin-page__input" type="time" bind:value={dashboard.hours.from} aria-label="Opening time" />
					<span class="admin-page__time-separator">to</span>
					<input class="admin-page__input" type="time" bind:value={dashboard.hours.to} aria-label="Closing time" />
				</div>
			</div>
		</div>
		<div class="admin-page__fields-row">
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Buffer between slots
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="0" bind:value={dashboard.buffer} />
						<span class="admin-page__input-suffix">min</span>
					</div>
				</label>
			</div>
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Minimum notice
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.notice} />
						<span class="admin-page__input-suffix">hrs</span>
					</div>
				</label>
			</div>
			<div class="admin-page__field">
				<label class="admin-page__field-label">
					Capacity per slot
					<div class="admin-page__input-wrap">
						<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.capacity} />
						<span class="admin-page__input-suffix">people</span>
					</div>
				</label>
			</div>
		</div>
	</div>
	<button class="admin-page__button-secondary" onclick={dashboard.save} disabled={dashboard.saving}>
		{#if dashboard.saving}
			<Loader size={12} class="admin-page__spin" />
			Saving...
		{:else}
			<Save size={12} />
			Save rules
		{/if}
	</button>
</div>

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
