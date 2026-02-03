<script>
	const { data } = $props()
</script>

<svelte:head>
	<title>Gym - Rainbow</title>
</svelte:head>

<div class="rainbow-page">
	<section class="hero">
		<div class="glow"></div>
		<p class="eyebrow">Rainbow Gym</p>
		<h1>Hang out. Work out.<br/>Whatever.</h1>
		<p class="sub">Grab a time slot and let's do something fun together.</p>
	</section>

	<section class="section">
		<div class="content-card">
			<div class="card-glow"></div>
			<h2>Book a Session</h2>
			<p>
				The booking calendar is coming soon. You'll be able to reserve
				equipment, book training sessions, and coordinate workout times
				with friends.
			</p>
			<div class="card-actions">
				<a href="/rainbow-gym" class="primary-btn">Use Classic Booking</a>
			</div>
		</div>
	</section>
</div>

<style>
	.card-actions {
		margin-top: 24px;
	}
</style>
