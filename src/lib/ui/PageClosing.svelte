<script lang="ts">
	import SectionLabel from '$lib/ui/SectionLabel.svelte'

	type PageClosingProps = {
		label: string
		title: string
		copy: string
		href: string
		linkLabel: string
		className?: string
		maxWidth?: string
	}

	const {
		label,
		title,
		copy,
		href,
		linkLabel,
		className = '',
		maxWidth = '32rem'
	}: PageClosingProps = $props()
</script>

<section class={`ui-page-closing ${className}`.trim()} style={`--ui-page-closing-max-width: ${maxWidth};`}>
	<div class="ui-page-closing__divider"></div>
	<SectionLabel text={label} />
	<h2 class="ui-page-closing__title">{title}</h2>
	<p class="ui-page-closing__copy">{copy}</p>
	<a href={href} class="ui-page-closing__link">{linkLabel}</a>
</section>

<style>
	.ui-page-closing {
		max-width: var(--ui-page-closing-max-width);
	}

	.ui-page-closing__divider {
		height: 1px;
		background: color-mix(in srgb, var(--border) 55%, transparent);
		margin-bottom: 2.9rem;
	}

	.ui-page-closing__title {
		margin: 0 0 0.6rem;
		font-family: var(--font-serif);
		font-size: clamp(1.55rem, 3.2vw, 1.95rem);
		font-weight: 500;
		line-height: 1.28;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.ui-page-closing__copy {
		margin: 0 0 1.3rem;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--muted);
	}

	.ui-page-closing__link {
		display: inline-block;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid currentColor;
		padding-bottom: 0.15rem;
		transition: opacity 0.2s ease;
	}

	.ui-page-closing__link:hover {
		opacity: 0.65;
	}
</style>
