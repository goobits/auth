<script lang="ts">
	import type { Snippet } from 'svelte'

	type PageShellProps = {
		className?: string
		children?: Snippet
	}

	const { className = '', children }: PageShellProps = $props()
</script>

<div class={`ui-page-shell ${className}`.trim()}>
	{@render children?.()}
</div>

<style>
	.ui-page-shell {
		--page-shell-space-top: 3.1rem;
		--page-shell-space-bottom: 5.25rem;
		--page-shell-space-top-mobile: 2.4rem;

		max-width: var(--max-width-readable);
		margin-inline: auto;
		padding-inline: 0;
		padding-top: var(--page-shell-space-top);
		padding-bottom: var(--page-shell-space-bottom);
	}

	@media (max-width: 760px) {
		.ui-page-shell {
			padding-top: var(--page-shell-space-top-mobile);
		}
	}
</style>
