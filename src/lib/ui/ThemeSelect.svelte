<script lang="ts">
	import { useTheme } from '@goobits/themes/svelte'

	const theme = useTheme()

	type ThemePreset = 'light' | 'dark' | 'magic'

	const presets: Array<{ id: ThemePreset; label: string }> = [
		{ id: 'light', label: 'Light' },
		{ id: 'dark', label: 'Dark' },
		{ id: 'magic', label: 'Magic' }
	]

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
</script>

<span class="ui-theme-select" role="group" aria-label="Theme">
	{#each presets as preset}
		<button
			type="button"
			class="ui-theme-select__option"
			class:ui-theme-select__option--active={activePreset === preset.id}
			aria-pressed={activePreset === preset.id}
			onclick={() => applyPreset(preset.id)}
		>
			{preset.label}
		</button>
	{/each}
</span>

<style>
	.ui-theme-select {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.ui-theme-select__option {
		border: 1px solid color-mix(in srgb, var(--color-white) 28%, transparent);
		background: color-mix(in srgb, var(--color-white) 6%, transparent);
		color: var(--color-white);
		border-radius: 999px;
		padding: 0.14rem 0.52rem;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		font-family: var(--font-sans);
		line-height: 1.4;
		transition: all 0.16s ease;
	}

	.ui-theme-select__option:hover {
		border-color: color-mix(in srgb, var(--color-white) 46%, transparent);
	}

	.ui-theme-select__option--active {
		background: color-mix(in srgb, var(--color-white) 22%, transparent);
		border-color: color-mix(in srgb, var(--color-white) 60%, transparent);
	}
</style>
