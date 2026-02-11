<script>
	import { ExternalLink, Folder } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const labs = [
		{ href: '/labs/color-galaxy', title: 'Color Galaxy' },
		{ href: '/labs/js1k/BreathingGalaxies.html', title: 'JS1k - Breathing Galaxies' },
		{ href: '/labs/js1k/Daltonize.html', title: 'JS1k - Daltonize' },
		{ href: '/labs/js1k/MicroSketchpad.html', title: 'JS1k - Micro Sketchpad' },
		{ href: '/labs/js1k/SpectrumDJ.html', title: 'JS1k - Spectrum DJ' },
		{ href: '/labs/midi-js', title: 'MIDI.js' },
		{ href: '/labs/sketch-js', title: 'Sketch.js' },
		{ href: '/labs/sketchpad-1.0', title: 'Sketchpad v1.0' },
		{ href: '/labs/thumbnailer', title: 'Thumbnailer' },
		{ href: '/labs/zen-bg', title: 'Zen BG' }
	];

	function isExternalLab(href) {
		return href.endsWith('.html')
	}
</script>

<svelte:head>
    <title>Labs - MIKO.ART</title>
</svelte:head>

<HeroBanner
	title="Labs"
	subtitle="Playful experiments, sketches, and odd ideas."
	icon="/media/emoji-labs.png"
/>

<div class="listing">
    {#each labs as lab}
        <a href={lab.href} class="lab-item">
			<Folder class="folder-icon" size={22} strokeWidth={2.1} />
            <span class="lab-title">{lab.title}</span>
			{#if isExternalLab(lab.href)}
				<ExternalLink class="external-icon" size={15} strokeWidth={2.2} />
			{/if}
        </a>
    {/each}
</div>

<style lang="scss">
	.listing {
		background-color: var(--lab-bg);
		border-radius: 0 0 0.5rem 0.5rem;
		display: grid;
		box-shadow: 0 2px 4px var(--shadow-panel);

		.lab-item {
			display: flex;
			align-items: center;
			gap: 1rem;
            padding: 0.5rem 1rem;
			background-color: var(--lab-item-bg);
			border-radius: 0.5rem;
			color: var(--lab-item-text);
			text-decoration: none;
			transition: all 0.2s ease;

			&:hover {
				background-color: var(--lab-item-hover-bg);
				transform: translateY(-1px);
				box-shadow: 0 2px 4px var(--shadow-panel);

				.folder-icon {
					color: var(--lab-icon-hover);
				}
			}

			.folder-icon {
				color: var(--lab-icon);
				transition: color 0.2s;
			}

			.lab-title {
				font-size: 1.125rem;
				flex: 1;
			}

			.external-icon {
				color: var(--muted);
				opacity: 0.75;
			}
		}
	}
</style>
