<script lang="ts">
	import type { Snippet } from 'svelte'
	import Button from './Button.svelte'
	import type { ButtonProps } from './button.types'

	let {
		href = '',
		type = 'button',
		variant = 'secondary',
		size = 'md',
		fullWidth = false,
		disabled = false,
		className = '',
		target,
		rel,
		ariaLabel,
		ariaSelected,
		ariaChecked,
		ariaExpanded,
		ariaHaspopup,
		role,
		title,
		onClick,
		children
	}: ButtonProps & { children?: Snippet } = $props()
</script>

<Button
	{href}
	{type}
	{variant}
	{size}
	pill
	{fullWidth}
	{disabled}
	{className}
	{target}
	{rel}
	{ariaLabel}
	{ariaSelected}
	{ariaChecked}
	{ariaExpanded}
	{ariaHaspopup}
	{role}
	{title}
	{onClick}
>
	{@render children?.()}
</Button>
