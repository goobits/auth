<script>
	import ActivityBookingPage from '$lib/booking/ActivityBookingPage.svelte'
	const { data } = $props()
</script>

<div class="calendar-activity-page calendar-activity-page--{data.activity.slug}">
	<div class="calendar-activity-page__content">
		<ActivityBookingPage activity={data.activity} />
	</div>
</div>

