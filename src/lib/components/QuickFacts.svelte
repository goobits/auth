<script lang="ts">
	let { facts } = $props<{ facts: { title: string; text: string; icon: string; accent: string }[] }>();
</script>

<section class="layout__section quick-facts" id="about">
	<div class="layout__container">
		<p class="layout__eyebrow">About the event</p>
		<h2 class="layout__title">What kind of event is this?</h2>
		<p class="quick-facts__intro">Think: playful, organized, and low-stress.</p>
		<div class="quick-facts__grid">
			{#each facts as fact (fact.title)}
				<article class="c-card quick-facts__card">
					<div class={`quick-facts__icon quick-facts__icon--${fact.accent}`} aria-hidden="true">{fact.icon}</div>
					<h3 class="quick-facts__card-title">{fact.title}</h3>
					<p class="quick-facts__card-copy">{fact.text}</p>
				</article>
			{/each}
		</div>
	</div>
</section>
