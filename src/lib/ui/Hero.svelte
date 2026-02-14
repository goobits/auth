<script lang="ts">
	type HeroProps = {
		eyebrow?: string
		title?: string
		titleLines?: string[]
		subtitle?: string
		icon?: string
		iconAlt?: string
		iconSize?: string
		className?: string
		heroClass?: string
		glowClass?: string
		eyebrowClass?: string
		titleClass?: string
		subtitleClass?: string
	}

	const {
		eyebrow = '',
		title = '',
		titleLines = [],
		subtitle = '',
		icon = '',
		iconAlt = '',
		iconSize = '0.85em',
		className = '',
		heroClass = '',
		glowClass = '',
		eyebrowClass = '',
		titleClass = '',
		subtitleClass = ''
	}: HeroProps = $props()
</script>

<section class={`ui-hero home__hero ${className} ${heroClass}`.trim()}>
	<div class={`ui-hero__glow ${glowClass}`.trim()} aria-hidden="true"></div>
	{#if eyebrow}
		<p class={`ui-hero__eyebrow ${eyebrowClass}`.trim()}>{eyebrow}</p>
	{/if}
	{#if titleLines.length > 0}
		<h1 class={`ui-hero__title ${titleClass}`.trim()}>
			{#each titleLines as line, index}
				{line}
				{#if index < titleLines.length - 1}<br />{/if}
			{/each}
			{#if icon}
				<img src={icon} class="ui-hero__icon" alt={iconAlt} style={`--hero-icon-size: ${iconSize};`} />
			{/if}
		</h1>
	{:else if title}
		<h1 class={`ui-hero__title ${titleClass}`.trim()}>
			{title}
			{#if icon}
				<img src={icon} class="ui-hero__icon" alt={iconAlt} style={`--hero-icon-size: ${iconSize};`} />
			{/if}
		</h1>
	{/if}
	{#if subtitle}
		<p class={`ui-hero__subtitle ${subtitleClass}`.trim()}>{subtitle}</p>
	{/if}
</section>

<style>
	.ui-hero__title {
		text-wrap: balance;
	}

	.ui-hero__subtitle {
		text-wrap: pretty;
	}

	.ui-hero__icon {
		width: var(--hero-icon-size);
		height: var(--hero-icon-size);
		vertical-align: -0.08em;
		margin-left: 0.35rem;
		object-fit: contain;
	}
</style>
