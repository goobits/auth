<script>
	import { Check, RefreshCw } from '@lucide/svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	const { dashboard } = $props()
</script>

<h1 class="admin-page__title">Integrations</h1>
<p class="admin-page__subtitle">Connect and manage external services.</p>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Google Calendar</h3>
		<span
			class="admin-page__status-badge"
			class:admin-page__status-badge--connected={dashboard.connected && !dashboard.connectionExpired}
			class:admin-page__status-badge--danger={dashboard.connected && dashboard.connectionExpired}
			class:admin-page__status-badge--muted={!dashboard.connected}
		>
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
	<p class="admin-page__section-description">Your bookings automatically sync with Google Calendar. Blocked times remove availability.</p>
	<div class="admin-page__button-row">
		<PillButton className="admin-page__button-secondary" variant="secondary" onClick={dashboard.reconnect}>
			<RefreshCw size={14} />
			{dashboard.connected ? 'Reconnect' : 'Connect'}
		</PillButton>
	</div>
</div>
