<script>
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
</script>

<svelte:head>
	<title>Adventure - Rainbow</title>
</svelte:head>

<div class="rainbow-page">
	<section class="hero">
		<div class="glow glow-adventure"></div>
		<p class="eyebrow eyebrow-adventure">Rainbow Adventure</p>
		<h1>Get outside.<br/>Find something new.</h1>
		<p class="sub">Outdoor excursions and group adventures in the Pacific Northwest.</p>
	</section>

	<BookingCalendar activityName="Rainbow Adventure" glowClass="form-glow-adventure" />
</div>
