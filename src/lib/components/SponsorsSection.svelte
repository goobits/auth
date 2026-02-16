<script lang="ts">
	let { sponsors } = $props<{ sponsors: { list: string[]; contactEmail: string } }>();
</script>

<section class="layout__section supporters" id="supporters">
	<div class="layout__container supporters__grid">
		<article class="supporters__panel">
			<h2 class="supporters__title">Want to support the herd?</h2>
			<p class="supporters__copy">We love in-kind support. It keeps this event practical and community-powered.</p>
			<ul>
				{#each sponsors.list as item}
					<li class="supporters__item">{item}</li>
				{/each}
			</ul>
			<a href={`mailto:${sponsors.contactEmail}`}>Offer support / Donate items</a>
		</article>
		<article class="supporters__panel">
			<h3 class="supporters__subtitle">Community supporters (thank you!)</h3>
			<div class="supporters__logos">
				<span class="supporters__logo">Supporter 1</span>
				<span class="supporters__logo">Supporter 2</span>
				<span class="supporters__logo">Supporter 3</span>
			</div>
			<p class="supporters__small">We keep sponsor presence gratitude-based and low-key.</p>
		</article>
	</div>
</section>
