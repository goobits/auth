<script>
	import { Palette, Sparkles } from '@lucide/svelte'
	import ConversationCta from '$lib/ui/ConversationCta.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import ShowcaseSection from '$lib/ui/ShowcaseSection.svelte'

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

<Hero
	title="Art"
	subtitle="Visual worlds, color studies, and interactive pieces."
	icon="/media/emoji-sparkling-heart.png"
/>

<div class="art showcase__page">
	<section class="showcase__section showcase__intro art__intro">
		<p>
			I explore art through code, drawing, interaction, and motion. These pieces sit at the
			intersection of playful tools and visual storytelling.
		</p>
	</section>

	<ShowcaseSection className="art__works" titleClassName="art__title" title="Selected Works">
		{#snippet icon()}
			<Palette size={17} strokeWidth={2.2} />
		{/snippet}
		<ul>
			{#each works as work}
				<li>
					<article class="art__work-card">
						<img src={work.image} alt={work.title} loading="lazy" />
						<div class="art__meta">
							<h3>{work.title}</h3>
							<p>{work.note}</p>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	</ShowcaseSection>

	<ShowcaseSection className="art__closing" titleClassName="art__title" title="Commissions & Exhibits">
		{#snippet icon()}
			<Sparkles size={17} strokeWidth={2.2} />
		{/snippet}
		<p>Interested in custom visual work, an installation, or an exhibition collaboration?</p>
		<ConversationCta className="art__pill-link" />
	</ShowcaseSection>
</div>

<style>
	:global(.art__works ul) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.art__work-card {
		height: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: color-mix(in srgb, var(--card-bg) 78%, transparent);
		display: grid;
		grid-template-rows: 150px auto;
	}

	.art__work-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.art__meta {
		padding: 0.65rem 0.75rem 0.75rem;
	}

	.art__meta h3 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1rem;
	}

	.art__meta p {
		margin: 0;
		color: var(--muted);
		font-size: 0.86rem;
		line-height: 1.45;
	}

	:global(.art__closing p) {
		margin: 0 0 0.75rem;
	}
</style>
