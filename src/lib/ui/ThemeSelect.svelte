<script lang="ts">
	import { useTheme } from '@goobits/themes/svelte'
	import Button from '$lib/ui/buttons/Button.svelte'

	type ThemePreset = 'light' | 'dark' | 'magic'

	const theme = useTheme()
	let rootEl: HTMLDivElement | null = null
	let menuOpen = $state(false)

	const activePreset = $derived.by<ThemePreset>(() => {
		if (theme.scheme === 'magic') return 'magic'
		return theme.theme === 'dark' ? 'dark' : 'light'
	})

	function applyPreset(preset: ThemePreset) {
		if (preset === 'magic') {
			theme.setScheme('magic')
			theme.setTheme('dark')
			return
		}
		theme.setScheme('default')
		theme.setTheme(preset)
	}

	function toggleMenu() {
		menuOpen = !menuOpen
	}

	function closeMenu() {
		menuOpen = false
	}

	function chooseTheme(preset: ThemePreset) {
		applyPreset(preset)
		closeMenu()
	}

	function onWindowClick(event: MouseEvent) {
		if (!menuOpen || !rootEl) return
		const target = event.target
		if (target instanceof Node && !rootEl.contains(target)) {
			closeMenu()
		}
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMenu()
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="ui-theme-select" bind:this={rootEl}>
	<Button
		type="button"
		className="ui-theme-select__trigger"
		onClick={toggleMenu}
		ariaHaspopup="menu"
		ariaExpanded={menuOpen}
		ariaLabel="Change theme"
		title="Theme"
	>
		<span class="ui-theme-select__icon" aria-hidden="true">
			{#if activePreset === 'light'}
				<svg viewBox="0 0 16 16">
					<circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4" />
					<path d="M8 1.6v1.7M8 12.7v1.7M1.6 8h1.7M12.7 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M3.3 12.7l1.2-1.2M11.5 4.5l1.2-1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
				</svg>
			{:else if activePreset === 'dark'}
				<svg viewBox="0 0 16 16">
					<path d="M13.2 10.4A5.6 5.6 0 0 1 5.6 2.8a5.6 5.6 0 1 0 7.6 7.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
				</svg>
			{:else}
				<svg viewBox="0 0 16 16">
					<path d="M8 1.8l1.2 3.2L12.4 6 9.2 7.1 8 10.3 6.8 7.1 3.6 6l3.2-1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
					<path d="M12 10.1l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
				</svg>
			{/if}
		</span>
		<svg viewBox="0 0 10 6" aria-hidden="true" class="ui-theme-select__chevron" class:open={menuOpen}>
			<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
		</svg>
	</Button>

	{#if menuOpen}
		<div class="ui-theme-select__menu" role="menu" aria-label="Theme options">
			<Button
				type="button"
				className={`ui-theme-select__option ${activePreset === 'light' ? 'active' : ''}`}
				onClick={() => chooseTheme('light')}
				role="menuitemradio"
				ariaChecked={activePreset === 'light'}
			>
				Light
			</Button>
			<Button
				type="button"
				className={`ui-theme-select__option ${activePreset === 'dark' ? 'active' : ''}`}
				onClick={() => chooseTheme('dark')}
				role="menuitemradio"
				ariaChecked={activePreset === 'dark'}
			>
				Dark
			</Button>
			<Button
				type="button"
				className={`ui-theme-select__option ${activePreset === 'magic' ? 'active' : ''}`}
				onClick={() => chooseTheme('magic')}
				role="menuitemradio"
				ariaChecked={activePreset === 'magic'}
			>
				Magic
			</Button>
		</div>
	{/if}
</div>

<style>
	.ui-theme-select {
		position: relative;
		display: inline-flex;
		align-items: center;
		z-index: 120;
	}

	:global(.ui-theme-select__trigger) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.32rem;
		background: color-mix(in srgb, var(--color-white) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-white) 30%, transparent);
		border-radius: 999px;
		color: var(--color-white);
		cursor: pointer;
		font-family: var(--font-ui-sans, var(--font-sans));
		font-size: 0.74rem;
		font-weight: 500;
		line-height: 0;
		min-height: 1.55rem;
		padding: 0.26rem 0.5rem;
		vertical-align: middle;
	}

	:global(.ui-theme-select__trigger:focus-visible) {
		outline: 2px solid color-mix(in srgb, var(--color-white) 64%, transparent);
		outline-offset: 2px;
	}

	.ui-theme-select__icon {
		display: block;
		width: 0.82rem;
		height: 0.82rem;
	}

	.ui-theme-select__icon svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.ui-theme-select__chevron {
		display: block;
		width: 0.48rem;
		height: 0.38rem;
		opacity: 0.88;
		transition: transform 0.18s ease;
	}

	.ui-theme-select__chevron.open {
		transform: rotate(180deg);
	}

	.ui-theme-select__menu {
		position: absolute;
		top: calc(100% + 0.45rem);
		right: 0;
		min-width: 6.4rem;
		padding: 0.25rem;
		border-radius: 0.62rem;
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		box-shadow: 0 14px 28px color-mix(in srgb, #000 20%, transparent);
		z-index: 130;
	}

	:global(.ui-theme-select__option) {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		border-radius: 0.45rem;
		color: var(--text);
		cursor: pointer;
		font-family: var(--font-ui-sans, var(--font-sans));
		font-size: 0.8rem;
		font-weight: 500;
		padding: 0.4rem 0.52rem;
	}

	:global(.ui-theme-select__option:hover),
	:global(.ui-theme-select__option:focus-visible) {
		background: color-mix(in srgb, var(--text) 11%, transparent);
		outline: none;
	}

	:global(.ui-theme-select__option.active) {
		background: color-mix(in srgb, var(--link) 24%, transparent);
		color: var(--text);
	}
</style>
