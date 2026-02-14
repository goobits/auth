<script lang="ts">
	import type { Snippet } from 'svelte'

	type PageContainerProps = {
		className?: string
		children?: Snippet
	}

	const { className = '', children }: PageContainerProps = $props()
</script>

<div class={`ui-page-container ${className}`.trim()}>
	{@render children?.()}
</div>
