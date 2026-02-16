<script lang="ts">
	import PillButton from '$lib/ui/buttons/PillButton.svelte'

	type FilterChipItem = string | { value: string; label: string }

	type FilterChipGroupProps = {
		items: FilterChipItem[]
		value?: string
		selected?: string[]
		multiple?: boolean
		className?: string
		ariaLabel?: string
	}

	let {
		items,
		value = $bindable(''),
		selected = $bindable([]),
		multiple = false,
		className = '',
		ariaLabel = 'Filter options'
	}: FilterChipGroupProps = $props()

	function getItemValue(item: FilterChipItem) {
		return typeof item === 'string' ? item : item.value
	}

	function getItemLabel(item: FilterChipItem) {
		return typeof item === 'string' ? item : item.label
	}

	function isActive(item: FilterChipItem) {
		const itemValue = getItemValue(item)
		return multiple ? selected.includes(itemValue) : value === itemValue
	}

	function toggle(item: FilterChipItem) {
		const itemValue = getItemValue(item)
		if (multiple) {
			selected = selected.includes(itemValue)
				? selected.filter((tag) => tag !== itemValue)
				: [...selected, itemValue]
			return
		}
		value = itemValue
	}
</script>

<div class={`ui-chip-group ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
	{#each items as item}
		<PillButton
			type="button"
			className={`ui-chip-group__button ${isActive(item) ? 'ui-chip-group__button--active' : ''}`}
			variant={isActive(item) ? 'primary' : 'secondary'}
			size="sm"
			onClick={() => toggle(item)}
		>
			{getItemLabel(item)}
		</PillButton>
	{/each}
</div>
