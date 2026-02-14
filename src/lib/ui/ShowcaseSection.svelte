<script lang="ts">
	import type { Snippet } from 'svelte'

	type ShowcaseSectionProps = {
		title: string
		className?: string
		titleClassName?: string
		icon?: Snippet
		children?: Snippet
	}

	const {
		title,
		className = '',
		titleClassName = '',
		icon,
		children
	}: ShowcaseSectionProps = $props()
</script>

<section class={`showcase__section ${className}`.trim()}>
	<h2 class={`showcase__title ${titleClassName}`.trim()}>
		{@render icon?.()}
		{title}
	</h2>
	{@render children?.()}
</section>
