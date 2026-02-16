<script lang="ts">
	let { eyebrow, title, subhead, dateLine, chips, reassurance } = $props<{
		eyebrow: string;
		title: string;
		subhead: string;
		dateLine: string;
		chips: string[];
		reassurance: string;
	}>();
</script>

<section class="hero" id="top">
	<div class="hero__sun" aria-hidden="true"></div>
	<div class="hero__cloud hero__cloud--1" aria-hidden="true"></div>
	<div class="hero__cloud hero__cloud--2" aria-hidden="true"></div>
	<div class="hero__cloud hero__cloud--3" aria-hidden="true"></div>
	<div class="hero__mountains" aria-hidden="true">
		<div class="hero__mountain-back"></div>
		<div class="hero__mountain-front"></div>
	</div>
	<div class="hero__trees" aria-hidden="true">
		<span class="hero__tree"></span>
		<span class="hero__tree hero__tree--small"></span>
		<span class="hero__tree hero__tree--large"></span>
		<span class="hero__tree hero__tree--small"></span>
		<span class="hero__tree"></span>
	</div>
	<div class="hero__ground" aria-hidden="true"></div>
	<div class="hero__dinos" aria-hidden="true">🦕 🦖 🏃 🦖 🦕</div>

	<div class="layout__container hero__content">
		<p class="hero__eyebrow">{eyebrow}</p>
		<h1 class="hero__title">{title}</h1>
		<p class="hero__subhead">{subhead}</p>
		<p class="hero__date">{dateLine}</p>
		<div class="hero__chips">
			{#each chips as chip (chip)}
				<span class="hero__chip">{chip}</span>
			{/each}
		</div>
		<div class="hero__actions">
			<a class="c-button c-button--primary c-button--large" href="/join">Join the Herd</a>
			<a class="c-button c-button--secondary c-button--large" href="/donate">Donate</a>
		</div>
		<p class="hero__reassurance">{reassurance}</p>
	</div>
</section>
