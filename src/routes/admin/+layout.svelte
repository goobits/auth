<script>
	import './Admin.scss'
	import Hero from '$lib/ui/Hero.svelte'
</script>

<div class="admin-root">
	<div class="admin-header">
		<h2 class="admin-title">Rainbow Gym</h2>
		<span class="admin-badge">Admin</span>
	</div>

	<div class="admin-shell__main">
		<Hero eyebrow="Admin" title="Members control room" subtitle="Bookings, invites, and Google Calendar connection." compact />
		<div class="admin-shell__content">
			<slot />
		</div>
	</div>
</div>
