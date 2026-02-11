<script lang="ts">
	import BookingCalendar from '$lib/booking/BookingCalendar.svelte'
	import type { CalendarActivityConfig } from '$lib/booking/activities'

	const { activity } = $props<{ activity: CalendarActivityConfig }>()
</script>

<svelte:head>
	<title>{activity.pageTitle}</title>
</svelte:head>

<div class="calendar-page calendar-activity calendar-activity--{activity.slug}">
	<section class="calendar-activity__hero hero">
		<div class={`calendar-activity__glow glow ${activity.glowClass || ''}`}></div>
		<p class={`calendar-activity__eyebrow eyebrow ${activity.eyebrowClass || ''}`}>{activity.eyebrow}</p>
		<h1 class="calendar-activity__title">
			{#each activity.heroTitleLines as line, index}
				{line}
				{#if index < activity.heroTitleLines.length - 1}<br/>{/if}
			{/each}
		</h1>
		<p class="calendar-activity__subtitle sub">{activity.heroSubtitle}</p>
	</section>

	<BookingCalendar activityName={activity.activityName} glowClass={activity.formGlowClass} />
</div>

<style lang="scss">
	.calendar-activity {
		&__hero {
			margin-bottom: 0.25rem;
		}

		&__title {
			text-wrap: balance;
		}

		&__subtitle {
			text-wrap: pretty;
		}
	}
</style>
