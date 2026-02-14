<script>
	import './About.scss'

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

	const offerings = [
		'Annotations & Editing for Online News: Innovative tools designed to enhance the digital news experience with user-friendly annotations and editing capabilities.',
		'Colorful Educational Musical Apps: Interactive and vibrant applications that fuse music with learning, making education both fun and engaging for all ages.',
		'Kiosk Software for Science & Learning Centers: Cutting-edge interactive kiosk software, bringing digital innovation to science and educational environments.',
		'Non-Destructive Illustration & Painting Apps: Sophisticated apps offering artists and designers the freedom to create with non-destructive editing tools.',
		'Promotional Contests for Sports Teams & Companies: Tailored contest platforms to boost engagement for sports teams and businesses, driving promotional success.',
		'Realtime Collaborative Apps: Dynamic applications enabling seamless collaboration in real-time, enhancing teamwork and productivity.',
		'User-Based Product Customization for Printing: Flexible design tools that allow users to personalize products, perfect for creating unique print-on-demand items.'
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

<div class="about-page">
	<section class="about-page__hero" aria-labelledby="about-title">
		<div class="about-page__intro-copy">
			<h1 id="about-title">Haai! I'm Miko <span aria-hidden="true">🦄</span></h1>
			<p class="about-page__tagline">Developer, designer & musician :)</p>
		</div>
	</section>

	<section class="about-page__intro">
		<figure class="about-page__photo-inset">
			<img src="/media/miko.jpg" alt="Portrait of Miko" width="240" height="240" loading="eager" />
		</figure>
		<p>
			I'm passionate about creating colorful, creative & educational applications.
		</p>
		<p>
			Founder & CTO of <a href="https://sketch.io" target="_blank" rel="noreferrer noopener">Sketch.IO</a>
			creators of Sketchpad 🎨
		</p>
		<p>
			Co-Founder of Portlandia Foods creators of Portland Ketchup 🪴
			<span class="about-page__muted">(acquired 2023)</span>
		</p>
		<p>
			Co-Founder of Lyrics Freak 🎵
			<span class="about-page__muted">(acquired 2010)</span>
		</p>
	</section>

	<section class="about-page__columns">
		<article>
			<h2>Exhibits, Selected</h2>
			<ul>
				{#each exhibits as exhibit}
					<li>{exhibit}</li>
				{/each}
				<li class="about-page__you"><a href="/contact">you</a>?</li>
			</ul>
		</article>

		<article>
			<h2>Clients, Selected</h2>
			<ul>
				{#each clients as client}
					<li>{client}</li>
				{/each}
				<li class="about-page__you"><a href="/contact">you</a>?</li>
			</ul>
		</article>
	</section>

	<section class="about-page__offerings" aria-labelledby="offerings-title">
		<h2 id="offerings-title">Sketch.IO specializes in creating a diverse range of design tools:</h2>
		<ul>
			{#each offerings as item}
				<li>{item}</li>
			{/each}
		</ul>
	</section>
</div>
