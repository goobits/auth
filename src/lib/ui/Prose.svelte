<script lang="ts">
	import type { Snippet } from 'svelte'

	type ProseProps = {
		className?: string
		children?: Snippet
	}

	const { className = '', children }: ProseProps = $props()
</script>

<article class={`ui-prose ${className}`.trim()}>
	{@render children?.()}
</article>
