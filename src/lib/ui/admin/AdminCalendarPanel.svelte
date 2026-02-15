<script>
	import { Check, RefreshCw } from '@lucide/svelte'
	const { dashboard } = $props()
</script>

<h1 class="admin-page__title">Calendar</h1>
<p class="admin-page__subtitle">Manage your Google Calendar connection and sync preferences.</p>
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
	<p class="admin-page__section-description">Your bookings automatically appear on your calendar. Blocked times on your calendar automatically remove availability from clients.</p>
	<div class="admin-page__button-row">
		<button class="admin-page__button-secondary" onclick={dashboard.reconnect}>
			<RefreshCw size={14} />
			{dashboard.connected ? 'Reconnect' : 'Connect'}
		</button>
	</div>
</div>
