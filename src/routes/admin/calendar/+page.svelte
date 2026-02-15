<script>
	import { createAdminCalendarConnectionController } from '$lib/viewmodels/admin-calendar-connection.svelte'

	const controller = createAdminCalendarConnectionController()
	controller.init()
</script>

<svelte:head>
	<title>Calendar | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<section class="admin-calendar">
	<h2>Calendar Connection</h2>
	<p class="admin-calendar__muted">Connect Google Calendar to unlock booking availability.</p>
	{#if controller.authChecking}
		<p class="admin-calendar__muted">Checking admin session...</p>
	{:else if !controller.authed}
		<p class="admin-calendar__error">Admin session required. Visit /admin to log in.</p>
	{:else}
		<button class="admin-calendar__connect" on:click={controller.connect}>Connect Google Calendar</button>
	{/if}
	{#if controller.status}
		<p class="admin-calendar__status">{controller.status}</p>
	{/if}
	{#if controller.error}
		<p class="admin-calendar__error">{controller.error}</p>
	{/if}

	<div class="admin-console__grid admin-calendar__grid">
		<div class="admin-console__card-surface admin-calendar__card">
			<h3>Live Status</h3>
			<p>{controller.connected ? 'Connected to Google Calendar.' : 'Not connected yet.'}</p>
		</div>
		<div class="admin-console__card-surface admin-calendar__card">
			<h3>Redirects</h3>
			<p class="admin-calendar__muted">After connecting, you’ll land in Rainbow Gym to test bookings.</p>
		</div>
	</div>
</section>

<style lang="scss">
	.admin-calendar__connect {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: var(--border-width) solid var(--brand-primary);
		background: var(--brand-primary);
		color: var(--color-white);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
	}

	.admin-calendar__status {
		color: var(--status-success-text);
	}

	.admin-calendar__muted {
		color: var(--muted);
	}

	.admin-calendar__error {
		color: var(--status-error-text);
	}
</style>
