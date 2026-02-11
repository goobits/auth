<script>
	import '../calendar/Calendar.scss'
	import ActivityBookingPage from '$lib/booking/ActivityBookingPage.svelte'
	import { CALENDAR_ACTIVITIES } from '$lib/booking/activities'
</script>

<ActivityBookingPage activity={CALENDAR_ACTIVITIES.gym} />
