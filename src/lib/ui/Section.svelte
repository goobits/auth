<script lang="ts">
	import type { Snippet } from 'svelte'

	type SectionProps = {
		className?: string
		children?: Snippet
	}

	const { className = '', children }: SectionProps = $props()
</script>

<section class={`ui-section ${className}`.trim()}>
	{@render children?.()}
</section>
