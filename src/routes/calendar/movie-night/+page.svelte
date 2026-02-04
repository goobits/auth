<script>
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
</script>

<svelte:head>
	<title>Movie Night | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page">
	<section class="hero">
		<div class="glow glow-movie"></div>
		<p class="eyebrow eyebrow-movie">Movie Night</p>
		<h1>Grab some snacks.<br/>Watch together.</h1>
		<p class="sub">Community movie screenings and cozy film nights.</p>
	</section>

	<BookingCalendar activityName="Movie Night" glowClass="form-glow-movie" />
</div>
