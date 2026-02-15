<script>
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'

	const exhibits = [
		'Art Gallery Of Ontario: Illusions Exhibition',
		'Dubai Union Metro: Art In Transit',
		'Google IO 2010: Darkroom',
		'Google IO 2012: Sketch Mobile',
		'Google IO 2013: Webcam FX',
		'Mackinac State Historic Parks',
		'Tel Aviv Museum Of Modern Art'
	]

	const clients = [
		'AAA',
		'ABCya Games',
		'Draw It To Know It: Medical & Biological Sciences',
		'Google: Made With Code',
		'Jo Malone London',
		'Los Alamos National Laboratory',
		'Portland Timbers: RCTID',
		'Scotties',
		'Travel Portland',
		'Upworthy'
	]

	const specialties = [
		{
			title: 'News Annotation & Editing',
			description: 'Tools for enhancing digital news experiences with user-friendly markup and editing.'
		},
		{
			title: 'Educational Music Apps',
			description: 'Interactive applications that fuse music with learning across all ages.'
		},
		{
			title: 'Kiosk Software',
			description: 'Interactive installations for science centers and educational environments.'
		},
		{
			title: 'Illustration & Painting',
			description: 'Non-destructive editing tools and workflows for artists and designers.'
		},
		{
			title: 'Promotional Contests',
			description: 'Tailored contest platforms for sports teams and businesses.'
		},
		{
			title: 'Realtime Collaboration',
			description: 'Applications enabling seamless teamwork and shared creation.'
		},
		{
			title: 'Product Customization',
			description: 'Design tools for personalized print-on-demand products.'
		}
	]
</script>

<svelte:head>
	<title>About - MIKO.ART</title>
	<meta
		name="description"
		content="Developer, designer, and musician building colorful, creative, and educational applications."
	/>
	<link rel="canonical" href="https://miko.art/about" />
</svelte:head>

<PageShell className="about-page">
	<Hero
		eyebrow="About"
		title="Haai! I'm Miko 🦄"
		subtitle="Developer, designer & musician"
	/>

	<section class="about-page__intro">
		<figure class="about-page__photo">
			<img
				src="/media/miko.jpg"
				alt="Portrait of Miko"
				width="160"
				height="160"
				loading="eager"
				decoding="async"
				fetchpriority="high"
			/>
		</figure>
		<div class="about-page__bio">
			<p>I'm passionate about creating colorful, creative & educational applications.</p>
			<p>
				Founder & CTO of
				<strong><a href="https://sketch.io" target="_blank" rel="noreferrer noopener nofollow">Sketch.IO</a></strong>,
				creators of Sketchpad 🎨
			</p>
			<p>
				Co-Founder of <strong>Portlandia Foods</strong>, creators of Portland Ketchup 🪴
				<span class="about-page__acquired">Acquired 2023</span>
			</p>
			<p>
				Co-Founder of <strong>Lyrics Freak</strong> 🎵
				<span class="about-page__acquired">Acquired 2010</span>
			</p>
		</div>
	</section>

	<section class="about-page__columns">
		<article>
			<h2>Exhibits, Selected</h2>
			<ul>
				{#each exhibits as exhibit}
					<li>{exhibit}</li>
				{/each}
				<li class="about-page__you"><a href="/contact?from=about&topic=venue">Your venue? →</a></li>
			</ul>
		</article>

		<article>
			<h2>Clients, Selected</h2>
			<ul>
				{#each clients as client}
					<li>{client}</li>
				{/each}
				<li class="about-page__you"><a href="/contact?from=about&topic=company">Your company? →</a></li>
			</ul>
		</article>
	</section>

	<section class="about-page__specialties" aria-labelledby="offerings-title">
		<div class="about-page__divider"></div>
		<h2 id="offerings-title">Sketch.IO specializes in design tools across industries</h2>
		<div class="about-page__specialties-grid">
			{#each specialties as specialty}
				<article class="about-page__specialty-item">
					<h3>{specialty.title}</h3>
					<p>{specialty.description}</p>
				</article>
			{/each}
		</div>
	</section>
</PageShell>
