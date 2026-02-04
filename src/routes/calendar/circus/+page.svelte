<script>
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
</script>

<svelte:head>
	<title>Circus - Rainbow</title>
</svelte:head>

<div class="calendar-page">
	<section class="hero">
		<div class="glow glow-circus"></div>
		<p class="eyebrow eyebrow-circus">Rainbow Circus</p>
		<h1>Fly high. Spin fast.<br/>Be brave.</h1>
		<p class="sub">Aerial arts and circus skills training for all levels.</p>
	</section>

	<BookingCalendar activityName="Rainbow Circus" glowClass="form-glow-circus" />
</div>
