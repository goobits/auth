<script>
	import Hero from '$lib/ui/Hero.svelte'
	import PageClosing from '$lib/ui/PageClosing.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'

	const works = [
		{
			title: 'Portland Ketchup Summer Tee',
			category: 'T-shirt design',
			image: '/media/stubs/product-stub-1.svg',
			note: 'Playful bottle mascot system and back-print layout for a seasonal apparel drop.'
		},
		{
			title: 'Late-Night Fries Club Shirt',
			category: 'T-shirt design',
			image: '/media/stubs/product-stub-2.svg',
			note: 'Bold one-color graphic concept built for high-contrast screen printing.'
		},
		{
			title: 'Ketchup & Friends Sticker Set',
			category: 'Merch',
			image: '/media/stubs/product-stub-3.svg',
			note: 'Character-led sticker sheet ideas with alternate expressions and mini slogans.'
		},
		{
			title: 'Hot Dog Cart Label Refresh',
			category: 'Packaging',
			image: '/media/stubs/product-stub-4.svg',
			note: 'Retro-inspired label direction balancing shelf readability with playful voice.'
		},
		{
			title: 'Funny Condiment Pin Collection',
			category: 'Accessories',
			image: '/media/stubs/product-stub-5.svg',
			note: 'Enamel pin concepts featuring cheeky micro-copy and icon-forward silhouettes.'
		},
		{
			title: 'Weekend Market Tote Series',
			category: 'Soft goods',
			image: '/media/stubs/product-stub-6.svg',
			note: 'Reusable tote family with modular lockups for events, popups, and collabs.'
		},
		{
			title: 'Snackline Poster Pack',
			category: 'Print',
			image: '/media/stubs/product-stub-7.svg',
			note: 'Whimsical promotional posters designed as companion pieces to apparel launches.'
		},
		{
			title: 'Pickle Parade Apron',
			category: 'Kitchenware',
			image: '/media/stubs/product-stub-8.svg',
			note: 'Front-pocket print layout with oversized character art and punchy typography.'
		},
		{
			title: 'Festival Booth Sign Kit',
			category: 'Brand system',
			image: '/media/stubs/product-stub-9.svg',
			note: 'Coordinated signage concepts tying merch, menu boards, and giveaway cards together.'
		}
	]
</script>

<svelte:head>
	<title>Art - MIKO.ART</title>
	<meta name="description" content="Art by Miko: visual experiments, color systems, and interactive works." />
</svelte:head>

<PageShell className="art-page">
	<Hero
		eyebrow="Art"
		title="Product design, playful merch, and weirdly fun ideas."
		subtitle="A working gallery of t-shirt concepts, Portland Ketchup experiments, packaging directions, and other product-ready visuals."
	/>

	<section class="art-page__works" aria-label="Selected works">
		{#each works as work}
			<article class="art-page__work">
				<div class="art-page__image-wrap">
					<img src={work.image} alt={work.title} loading="lazy" />
				</div>
				<p class="art-page__work-type">{work.category}</p>
				<h2>{work.title}</h2>
				<p>{work.note}</p>
			</article>
		{/each}
	</section>

	<PageClosing
		className="art-page__closing"
		label="Commissions & Exhibits"
		title="Interested in working together?"
		copy="Custom visual work, installations, or exhibition collaborations. Let&apos;s talk about what you have in mind."
		href="/contact"
		linkLabel="Get in touch"
		maxWidth="31.25rem"
	/>
</PageShell>

<style lang="scss">
	:global(.art-page) {
		--art-grid-gap-row: 2.4rem;
		--art-grid-gap-col: 1.5rem;
		--art-image-radius: 11px;
		--art-image-margin: 0.9rem;
		--art-title-font: 1.03rem;
		--art-title-margin: 0 0 0.2rem;
		--art-type-font: 0.7rem;
		--art-copy-font: 0.9rem;
		--art-mobile-gap: 2.2rem;
	}

	.art-page__works {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--art-grid-gap-row) var(--art-grid-gap-col);
		margin-bottom: 4.25rem;
	}

	.art-page__work {
		cursor: default;
	}

	.art-page__image-wrap {
		aspect-ratio: 4 / 3;
		border-radius: var(--art-image-radius);
		overflow: hidden;
		margin-bottom: var(--art-image-margin);
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
		margin: var(--art-title-margin);
		font-family: var(--font-display);
		font-size: var(--art-title-font);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.art-page__work-type {
		margin: var(--art-title-margin);
		font-size: var(--art-type-font);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.art-page__work p {
		margin: 0;
		color: var(--muted);
		font-size: var(--art-copy-font);
		line-height: 1.52;
	}

	@media (max-width: 980px) {
		.art-page__works {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.art-page__works {
			grid-template-columns: 1fr;
			gap: var(--art-mobile-gap);
		}
	}
</style>
