<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { ButtonProps } from './button.types'

	let {
		href = '',
		type = 'button',
		variant = 'secondary',
		size = 'md',
		pill = false,
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

	const classes = $derived(
		[
			'ui-button',
			`ui-button--${variant}`,
			`ui-button--${size}`,
			pill ? 'ui-button--pill' : '',
			fullWidth ? 'ui-button--full' : '',
			disabled ? 'ui-button--disabled' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	)

	function handleClick(event: MouseEvent) {
		if (disabled) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		onClick?.(event)
	}
</script>

{#if href}
	<a
		href={disabled ? undefined : href}
		class={classes}
		aria-label={ariaLabel}
		aria-selected={ariaSelected}
		aria-checked={ariaChecked}
		aria-expanded={ariaExpanded}
		aria-haspopup={ariaHaspopup}
		role={role}
		aria-disabled={disabled}
		tabindex={disabled ? -1 : undefined}
		title={title}
		target={target}
		rel={rel}
		onclick={handleClick}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		type={type}
		class={classes}
		aria-label={ariaLabel}
		aria-selected={ariaSelected}
		aria-checked={ariaChecked}
		aria-expanded={ariaExpanded}
		aria-haspopup={ariaHaspopup}
		role={role}
		title={title}
		disabled={disabled}
		onclick={handleClick}
	>
		{@render children?.()}
	</button>
{/if}

<style>
	.ui-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: var(--border-width) solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font-family: var(--font-ui-sans, var(--font-sans));
		font-weight: var(--font-weight-medium);
		line-height: 1.2;
		text-decoration: none;
		transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
	}

	.ui-button--pill {
		border-radius: var(--radius-pill);
	}

	.ui-button--sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
	}

	.ui-button--md {
		padding: 0.5rem 1.125rem;
		font-size: 0.8125rem;
	}

	.ui-button--lg {
		padding: 0.8125rem 1.5rem;
		font-size: 0.875rem;
	}

	.ui-button--full {
		width: 100%;
	}

	.ui-button--start {
		justify-content: flex-start;
	}

	.ui-button--primary {
		background: var(--button-bg);
		border-color: color-mix(in srgb, var(--button-bg) 70%, var(--text));
		color: var(--button-text, var(--color-white));
		box-shadow: 0 2px 20px color-mix(in srgb, var(--button-bg) 26%, transparent);
	}

	.ui-button--primary:hover:not(.ui-button--disabled) {
		background: color-mix(in srgb, var(--button-bg) 84%, var(--text));
		border-color: color-mix(in srgb, var(--button-bg) 62%, var(--text));
		transform: translateY(-1px);
	}

	.ui-button--secondary {
		background: transparent;
		border-color: color-mix(in srgb, var(--border) 70%, transparent);
		color: var(--text);
	}

	.ui-button--secondary:hover:not(.ui-button--disabled) {
		background: color-mix(in srgb, var(--text) 4%, transparent);
		border-color: color-mix(in srgb, var(--text) 25%, transparent);
	}

	.ui-button--ghost {
		background: transparent;
		border-color: var(--color-white-12, color-mix(in srgb, var(--border) 50%, transparent));
		color: color-mix(in srgb, var(--calendar-shell-text, var(--text)) 56%, transparent);
	}

	.ui-button--ghost:hover:not(.ui-button--disabled) {
		border-color: var(--color-white-24, color-mix(in srgb, var(--text) 20%, transparent));
		color: var(--calendar-shell-text, var(--text));
	}

	.ui-button--danger {
		background: transparent;
		border-color: color-mix(in srgb, var(--status-error-text) 45%, transparent);
		color: var(--status-error-text);
	}

	.ui-button--danger:hover:not(.ui-button--disabled) {
		background: color-mix(in srgb, var(--status-error-text) 10%, transparent);
		border-color: color-mix(in srgb, var(--status-error-text) 70%, transparent);
	}

	.ui-button--disabled {
		opacity: 0.55;
		cursor: not-allowed;
		transform: none;
	}
	.ui-button:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--link) 45%, transparent);
		outline-offset: 2px;
	}
</style>
