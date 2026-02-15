<script lang="ts">
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
		<button
			type="button"
			role="tab"
			class="ui-segmented__button"
			class:ui-segmented__button--active={value === option.value}
			aria-selected={value === option.value}
			onclick={() => (value = option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
