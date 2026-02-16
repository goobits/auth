<script lang="ts">
	let { title, subhead, dateLine, chips, reassurance } = $props<{
		title: string;
		subhead: string;
		dateLine: string;
		chips: string[];
		reassurance: string;
	}>();
</script>

<section class="layout__section hero" id="top">
	<div class="layout__container hero__grid">
		<div>
			<h1 class="hero__title">{title}</h1>
			<p class="hero__subhead">{subhead}</p>
			<p class="hero__date">{dateLine}</p>
			<div class="hero__chips">
				{#each chips as chip}
					<span class="hero__chip">{chip}</span>
				{/each}
			</div>
			<div class="hero__actions">
				<a class="c-button c-button--primary" href="#volunteer">Join the Herd</a>
				<a class="c-button c-button--secondary" href="#donate">Donate</a>
				<a class="hero__text-link" href="#volunteer">Volunteer for a 90-minute shift</a>
			</div>
			<p class="hero__reassurance">{reassurance}</p>
		</div>

		<div class="hero__art" aria-hidden="true">
			<div class="hero__sun"></div>
			<div class="hero__mountain"></div>
			<div class="hero__tree hero__tree--left"></div>
			<div class="hero__tree hero__tree--right"></div>
			<div class="hero__dino">🦖</div>
		</div>
	</div>
</section>
