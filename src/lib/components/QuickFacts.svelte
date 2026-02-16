<script lang="ts">
	let { facts } = $props<{ facts: { title: string; text: string }[] }>();
</script>

<section class="layout__section quick-facts" id="about">
	<div class="layout__container">
		<h2 class="layout__title">What kind of event is this?</h2>
		<p class="quick-facts__intro">Think: playful, organized, and low-stress.</p>
		<div class="quick-facts__grid">
			{#each facts as fact (fact.title)}
				<article class="c-card quick-facts__card">
					<h3 class="quick-facts__card-title">{fact.title}</h3>
					<p class="quick-facts__card-copy">{fact.text}</p>
				</article>
			{/each}
		</div>
	</div>
</section>
