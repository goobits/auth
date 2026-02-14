<script lang="ts">
	import Hero from '$lib/ui/Hero.svelte'
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
	import type { CalendarActivityConfig } from '$lib/booking/activities'

	const { activity } = $props<{ activity: CalendarActivityConfig }>()
</script>

<svelte:head>
	<title>{activity.pageTitle}</title>
</svelte:head>

<div class="calendar-page calendar-activity calendar-activity--{activity.slug}">
	<Hero
		className="calendar-activity__hero calendar-page__hero"
		glowClass={`calendar-activity__glow calendar-page__hero-glow ${activity.glowClass || ''}`}
		eyebrowClass={`calendar-activity__eyebrow calendar-page__eyebrow ${activity.eyebrowClass || ''}`}
		titleClass="calendar-activity__title"
		subtitleClass="calendar-activity__subtitle calendar-page__subtitle"
		eyebrow={activity.eyebrow}
		titleLines={activity.heroTitleLines}
		subtitle={activity.heroSubtitle}
	/>

	<BookingCalendar activityName={activity.activityName} glowClass={activity.formGlowClass} />
</div>

<style lang="scss">
	.calendar-activity__hero {
		margin-bottom: 0.25rem;
	}

	.calendar-activity__title {
		text-wrap: balance;
	}

	.calendar-activity__subtitle {
		text-wrap: pretty;
	}
</style>
