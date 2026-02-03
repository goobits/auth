<script>
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
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

	<BookingCalendar activityName="Rainbow Gym" />
</div>
