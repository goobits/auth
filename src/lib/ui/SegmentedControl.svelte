<script lang="ts">
	import Button from '$lib/ui/buttons/Button.svelte'

	export type SegmentedOption = {
		value: string
		label: string
	}

	type SegmentedControlProps = {
		options: SegmentedOption[]
		value?: string
		className?: string
		ariaLabel?: string
	}

	let {
		options,
		value = $bindable(''),
		className = '',
		ariaLabel = 'Segmented control'
	}: SegmentedControlProps = $props()
</script>

<div class={`ui-segmented ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
	{#each options as option}
		<Button
			type="button"
			role="tab"
			className={`ui-segmented__button ${value === option.value ? 'ui-segmented__button--active' : ''}`}
			variant="ghost"
			size="sm"
			ariaSelected={value === option.value}
			ariaLabel={option.label}
			onClick={() => (value = option.value)}
		>
			{option.label}
		</Button>
	{/each}
</div>
