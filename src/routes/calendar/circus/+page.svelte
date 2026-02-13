<script>
	import ActivityBookingPage from '$lib/booking/ActivityBookingPage.svelte'
	import { CALENDAR_ACTIVITIES } from '$lib/booking/activities'
</script>

<div class="calendar-activity-page calendar-activity-page--circus">
	<div class="calendar-activity-page__content">
		<ActivityBookingPage activity={CALENDAR_ACTIVITIES.circus} />
	</div>
</div>
