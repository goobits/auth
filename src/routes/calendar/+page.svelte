<script>
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	const { data } = $props()

	const firstName = $derived(data.user?.name?.split(' ')[0] || '')
</script>

<svelte:head>
	<title>Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-home">
	<section class="calendar-page__hero calendar-home__hero">
		<div class="calendar-page__hero-glow calendar-home__glow"></div>
		<p class="calendar-page__eyebrow calendar-home__eyebrow">Members</p>
		<h1>Hey{firstName ? `, ${firstName}` : ''}.<br/>What's the move?</h1>
		<p class="calendar-page__subtitle calendar-home__sub">Pick an activity and let's make something happen.</p>
	</section>

	<section class="calendar-page__section calendar-home__section">
		<div class="calendar-page__activity-grid calendar-home__grid">
			{#each CALENDAR_ACTIVITY_LIST as activity}
				<a href={activity.href} class="calendar-page__activity-card calendar-home__card">
					<span class="calendar-page__activity-icon calendar-home__icon">{activity.icon}</span>
					<h2>{activity.label}</h2>
					<p>{activity.description}</p>
				</a>
			{/each}
		</div>
	</section>
</div>
