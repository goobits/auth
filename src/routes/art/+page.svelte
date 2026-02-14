<script>
	import Hero from '$lib/ui/Hero.svelte'

	const works = [
		{
			title: 'Color Sphere',
			image: '/media/project-color-sphere.png',
			note: 'Chromatic studies and immersive color systems.'
		},
		{
			title: 'Sand Art',
			image: '/media/project-sand-art.png',
			note: 'Organic texture experiments and playful simulation.'
		},
		{
			title: 'Color Piano',
			image: '/media/project-color-piano.png',
			note: 'Synesthetic visuals shaped by musical harmony.'
		},
		{
			title: 'Zendala',
			image: '/media/project-zendala.png',
			note: 'Meditative geometry, symmetry, and rhythm.'
		},
		{
			title: 'Sketchpad',
			image: '/media/project-sketchpad.png',
			note: 'Digital illustration systems for expressive making.'
		},
		{
			title: 'Be Here Meow',
			image: '/media/project-be-here-meow.png',
			note: 'Character-driven artwork with warmth and wit.'
		}
	]
</script>

<svelte:head>
	<title>Art - MIKO.ART</title>
	<meta name="description" content="Art by Miko: visual experiments, color systems, and interactive works." />
</svelte:head>

<div class="art-page">
	<Hero
		eyebrow="Art"
		title="Visual worlds, color studies, and interactive pieces."
		subtitle="I explore art through code, drawing, interaction, and motion. These pieces sit at the intersection of playful tools and visual storytelling."
	/>

	<section class="art-page__works" aria-label="Selected works">
		{#each works as work}
			<article class="art-page__work">
				<div class="art-page__image-wrap">
					<img src={work.image} alt={work.title} loading="lazy" />
				</div>
				<h2>{work.title}</h2>
				<p>{work.note}</p>
			</article>
		{/each}
	</section>

	<section class="art-page__closing" aria-label="Commissions and exhibits">
		<div class="art-page__divider"></div>
		<p class="art-page__label">Commissions & Exhibits</p>
		<h2>Interested in working together?</h2>
		<p class="art-page__closing-copy">
			Custom visual work, installations, or exhibition collaborations. Let&apos;s talk about what
			you have in mind.
		</p>
		<a href="/contact" class="art-page__contact-link">Get in touch</a>
	</section>
</div>

<style lang="scss">
	.art-page {
		max-width: 980px;
		margin: 0 auto;
		padding: 3.1rem 1.25rem 5.25rem;
	}

	.art-page__works {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 2.8rem 2.25rem;
		margin-bottom: 4.25rem;
	}

	.art-page__work {
		cursor: default;
	}

	.art-page__image-wrap {
		aspect-ratio: 4 / 3;
		border-radius: 11px;
		overflow: hidden;
		margin-bottom: 0.9rem;
		background: color-mix(in srgb, var(--card-bg) 85%, var(--bg));
	}

	.art-page__work img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		opacity: 0.96;
		transition: transform 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
	}

	.art-page__work:hover img {
		transform: scale(1.03);
		opacity: 1;
	}

	.art-page__work h2 {
		margin: 0 0 0.2rem;
		font-family: var(--font-display);
		font-size: 1.03rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.art-page__work p {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1.52;
	}

	.art-page__closing {
		max-width: 500px;
	}

	.art-page__divider {
		height: 1px;
		background: color-mix(in srgb, var(--border) 55%, transparent);
		margin-bottom: 2.9rem;
	}

	.art-page__closing h2 {
		margin: 0 0 0.6rem;
		font-family: var(--font-serif);
		font-size: clamp(1.55rem, 3.2vw, 1.95rem);
		font-weight: 500;
		line-height: 1.28;
		letter-spacing: -0.02em;
	}

	.art-page__closing-copy {
		margin: 0 0 1.3rem;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--muted);
	}

	.art-page__contact-link {
		display: inline-block;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid currentColor;
		padding-bottom: 0.15rem;
		transition: opacity 0.2s ease;
	}

	.art-page__contact-link:hover {
		opacity: 0.65;
	}

	@media (max-width: 760px) {
		.art-page {
			padding-top: 2.4rem;
		}

		.art-page__works {
			grid-template-columns: 1fr;
			gap: 2.2rem;
		}
	}
</style>
