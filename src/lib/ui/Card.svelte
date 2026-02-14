<script lang="ts">
	import type { Snippet } from 'svelte'

	type CardProps = {
		className?: string
		children?: Snippet
	}

	const { className = '', children }: CardProps = $props()
</script>

<div class={`ui-card ${className}`.trim()}>
	{@render children?.()}
</div>
