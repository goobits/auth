<script lang="ts">
	type SectionLabelProps = {
		text: string
		className?: string
	}

	const { text, className = '' }: SectionLabelProps = $props()
</script>

<p class={`ui-section-label ${className}`.trim()}>{text}</p>

<style>
	.ui-section-label {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--muted);
	}
</style>
