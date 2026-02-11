<script>
	import { ArrowUpRight, Palette, Sparkles } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

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

<HeroBanner
	title="Art"
	subtitle="Visual worlds, color studies, and interactive pieces."
	icon="/media/emoji-sparkling-heart.png"
/>

<div class="art-page">
	<section class="intro">
		<p>
			I explore art through code, drawing, interaction, and motion. These pieces sit at the
			intersection of playful tools and visual storytelling.
		</p>
	</section>

	<section class="works">
		<h2><Palette size={17} strokeWidth={2.2} /> Selected Works</h2>
		<ul>
			{#each works as work}
				<li>
					<article>
						<img src={work.image} alt={work.title} loading="lazy" />
						<div class="meta">
							<h3>{work.title}</h3>
							<p>{work.note}</p>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	</section>

	<section class="closing">
		<h2><Sparkles size={17} strokeWidth={2.2} /> Commissions & Exhibits</h2>
		<p>Interested in custom visual work, an installation, or an exhibition collaboration?</p>
		<a href="/contact">
			Start a conversation
			<ArrowUpRight size={14} strokeWidth={2.2} />
		</a>
	</section>
</div>

<style>
	.art-page {
		max-width: var(--max-width);
		margin: 0 auto;
		display: grid;
		gap: 1rem;
	}

	.intro,
	.works,
	.closing {
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		background: var(--card-bg);
		padding: 1rem;
	}

	.intro p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 1.03rem;
		line-height: 1.72;
	}

	h2 {
		margin: 0 0 0.75rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 500;
	}

	.works ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.works article {
		height: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: color-mix(in srgb, var(--card-bg) 78%, transparent);
		display: grid;
		grid-template-rows: 150px auto;
	}

	.works img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.meta {
		padding: 0.65rem 0.75rem 0.75rem;
	}

	.meta h3 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1rem;
	}

	.meta p {
		margin: 0;
		color: var(--muted);
		font-size: 0.86rem;
		line-height: 1.45;
	}

	.closing p {
		margin: 0 0 0.75rem;
	}

	.closing a {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		text-decoration: none;
		padding: 0.42rem 0.72rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--card-bg);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 0.82rem;
		font-weight: 600;
	}
</style>
