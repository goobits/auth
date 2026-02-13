<script>
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	const { data } = $props()

	const firstName = $derived(data.user?.name?.split(' ')[0] || '')
</script>

<svelte:head>
	<title>Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-home">
	<section class="hero calendar-home__hero">
		<div class="glow calendar-home__glow"></div>
		<p class="eyebrow calendar-home__eyebrow">Members</p>
		<h1>Hey{firstName ? `, ${firstName}` : ''}.<br/>What's the move?</h1>
		<p class="sub calendar-home__sub">Pick an activity and let's make something happen.</p>
	</section>

	<section class="section calendar-home__section">
		<div class="activity-grid calendar-home__grid">
			{#each CALENDAR_ACTIVITY_LIST as activity}
				<a href={activity.href} class="activity-card calendar-home__card">
					<span class="activity-icon calendar-home__icon">{activity.icon}</span>
					<h2>{activity.label}</h2>
					<p>{activity.description}</p>
				</a>
			{/each}
		</div>
	</section>
</div>
