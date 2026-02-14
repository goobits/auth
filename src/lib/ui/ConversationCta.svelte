<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte'

	type ConversationCtaProps = {
		href?: string
		label?: string
		className?: string
		withIcon?: boolean
	}

	const {
		href = '/contact',
		label = 'Start a conversation',
		className = '',
		withIcon = true
	}: ConversationCtaProps = $props()
</script>

<a href={href} class={`showcase__pill-link ${className}`.trim()}>
	{label}
	{#if withIcon}
		<ArrowUpRight size={14} strokeWidth={2.2} />
	{/if}
</a>
