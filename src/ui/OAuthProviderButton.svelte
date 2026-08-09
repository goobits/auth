<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements'

	type OAuthProviderBrand = 'apple' | 'google'

	interface SharedProps {
		provider: OAuthProviderBrand
		label: string
		busy?: boolean
	}

	type Props = SharedProps & Omit<HTMLButtonAttributes, 'aria-busy' | 'children' | 'type'>

	const {
		provider,
		label,
		busy = false,
		disabled = false,
		class: className = '',
		...rest
	}: Props = $props()
	const classes = $derived(`oauth-provider oauth-provider--${provider} ${className}`.trim())

	const marks = {
		apple: new URL('./assets/apple-mark.svg', import.meta.url).href,
		google: new URL('./assets/google-mark.svg', import.meta.url).href
	} satisfies Record<OAuthProviderBrand, string>
</script>

<button
	{...rest}
	type="button"
	class={classes}
	disabled={disabled || busy}
	aria-busy={busy || undefined}
>
	<img class="oauth-provider__mark" src={marks[provider]} alt="" aria-hidden="true" />
	<span>{label}</span>
</button>

<style>
	.oauth-provider {
		display: flex;
		align-items: center;
		width: 100%;
		min-width: 140px;
		height: 44px;
		margin: 0;
		border-radius: 8px;
		cursor: pointer;
		transition: filter 120ms ease;
	}

	.oauth-provider:focus-visible {
		outline: 2px solid var(--auth-provider-focus, #2563eb);
		outline-offset: 2px;
	}

	.oauth-provider:hover:not(:disabled) {
		filter: brightness(0.96);
	}

	.oauth-provider:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.oauth-provider--google {
		gap: 10px;
		padding: 0 12px;
		border: 1px solid #747775;
		background: #fff;
		color: #1f1f1f;
		font-family: 'Google Sans', Roboto, Arial, sans-serif;
		font-size: 14px;
		font-weight: 500;
		line-height: 20px;
	}

	.oauth-provider--google .oauth-provider__mark {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.oauth-provider--apple {
		justify-content: center;
		padding: 0 max(8%, 12px);
		border: 0;
		background: #000;
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 19px;
		font-weight: 500;
		line-height: 1;
	}

	.oauth-provider--apple .oauth-provider__mark {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
	}
</style>
