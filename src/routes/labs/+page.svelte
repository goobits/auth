<script>
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
</script>

<svelte:head>
    <title>Labs - MIKO.ART</title>
</svelte:head>

<div class="hero">
    <h1>Labs ✨</h1>
    <h2>Experiments through the ages.</h2>
</div>

<div class="listing">
    {#each labs as lab}
        <a href={lab.href} class="lab-item">
            <svg class="folder-icon" viewBox="0 0 24 24" width="24" height="24">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{lab.title}</span>
        </a>
    {/each}
</div>

<style lang="scss">
	.hero {
		h2 {
			margin-bottom: 3rem;
		}
	}

	.listing {
		background-color: #ffffff;
		border-radius: 0 0 0.5rem 0.5rem;
		display: grid;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

		.lab-item {
			display: flex;
			align-items: center;
			gap: 1rem;
            padding: 0.5rem 1rem;
			background-color: #f8fafc;
			border-radius: 0.5rem;
			color: #2d3748;
			text-decoration: none;
			transition: all 0.2s ease;

			&:hover {
				background-color: #edf2f7;
				transform: translateY(-1px);
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

				.folder-icon {
					fill: #4299e1;
				}
			}

			.folder-icon {
				fill: #63b3ed;
				transition: fill 0.2s;
			}

			span {
				font-size: 1.125rem;
			}
		}
	}
</style>