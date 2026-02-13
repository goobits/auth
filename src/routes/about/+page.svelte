<script>
	import './About.scss'

	const ventures = [
		{
			emoji: '🎨',
			name: 'Sketch.IO',
			role: 'Founder & CTO',
			description: 'Home of Sketchpad. Creative brushes in browsers and smiles on faces since day one.',
			href: 'https://sketch.io/'
		},
		{
			emoji: '🪴',
			name: 'Portlandia Foods',
			role: 'Co-Founder',
			description: 'Creators of Portland Ketchup, because condiments deserve the same love as code.',
			href: 'https://portlandiafoods.com/',
			badge: 'Acquired 2023'
		},
		{
			emoji: '🎵',
			name: 'Lyrics Freak',
			role: 'Co-Founder',
			description: "One of the internet's earliest lyrics destinations and a longtime music rabbit hole.",
			href: 'https://lyricsfreak.com/',
			badge: 'Acquired 2010'
		}
	]

	const exhibits = [
		{ title: 'Art Gallery of Ontario', detail: 'Illusions' },
		{ title: 'Dubai Union Metro', detail: 'Art in Transit' },
		{ title: 'Google I/O', detail: '2010, 2012, 2013' },
		{ title: 'Mackinac State Historic Parks' },
		{ title: 'Tel Aviv Museum of Modern Art' }
	]

	const clients = [
		'AAA',
		'ABCya Games',
		'Draw It To Know It',
		'Google, Made With Code',
		'Jo Malone London',
		'Los Alamos National Laboratory',
		'Portland Timbers'
	]

	const services = [
		{ icon: '📰', name: 'News Annotations', description: 'Intuitive markup tools for modern digital newsrooms.' },
		{ icon: '🎹', name: 'Musical Apps', description: 'Vibrant products blending sound, interaction, and learning.' },
		{ icon: '🔬', name: 'Kiosk Software', description: 'Interactive exhibits for science and educational spaces.' },
		{ icon: '🖌️', name: 'Illustration Tools', description: 'Non-destructive workflows for artists and designers.' },
		{ icon: '🏆', name: 'Promo Contests', description: 'Audience engagement platforms for teams and brands.' },
		{ icon: '⚡', name: 'Realtime Collaboration', description: 'Build together from anywhere in real time.' },
		{
			icon: '🖨️',
			name: 'Product Customizers',
			description: 'Personalize-then-print interfaces for on-demand products.'
		}
	]
</script>

<svelte:head>
	<title>About - MIKO.ART</title>
	<meta
		name="description"
		content="About Miko: founder, product builder, and creative technologist behind colorful tools and experiences."
	/>
	<link rel="canonical" href="https://miko.art/about" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="About - MIKO.ART" />
	<meta
		property="og:description"
		content="Founder, product builder, and creative technologist behind colorful tools and experiences."
	/>
	<meta property="og:url" content="https://miko.art/about" />
	<meta property="og:image" content="https://miko.art/media/miko.jpg" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="about-page about">
	<section class="hero-row about__hero" aria-labelledby="about-title">
		<div class="avatar-ring about__avatar-ring">
			<div class="avatar-inner about__avatar-inner">
				<img
					src="/media/miko.jpg"
					alt="Portrait of Miko"
					width="96"
					height="96"
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>
			</div>
		</div>
		<div class="hero-copy about__hero-copy">
			<h1 id="about-title">Haai! I'm <span class="rainbow-text about__rainbow-text">Miko</span> <span aria-hidden="true">🦄</span></h1>
			<p>
				Developer, designer, and musician passionate about making colorful, creative, and educational things
				for the internet.
			</p>
		</div>
	</section>

	<section class="lede about__lede">
		<p>
			I love it when tools disappear into the act of creating. When all that's left is imagination, flow, and
			joy. That's what I love building. <span class="sparkle about__sparkle" aria-hidden="true">✨</span>
		</p>
	</section>

	<section class="ventures about__ventures" aria-labelledby="ventures-title">
		<h2 id="ventures-title" class="section-label about__section-label">Building Things ✦</h2>
		<div class="venture-grid about__venture-grid">
			{#each ventures as venture}
				<a href={venture.href} target="_blank" rel="noopener noreferrer" class="venture-card about__venture-card">
					<span class="emoji about__emoji" aria-hidden="true">{venture.emoji}</span>
					<h3>{venture.name}</h3>
					<p class="role about__role">{venture.role}</p>
					<p class="text about__text">{venture.description}</p>
					{#if venture.badge}
						<span class="badge about__badge">{venture.badge}</span>
					{/if}
				</a>
			{/each}
		</div>
	</section>

	<section class="two-col about__columns">
		<article class="info-card about__info-card" aria-labelledby="exhibits-title">
			<h2 id="exhibits-title" class="section-label about__section-label">Selected Exhibits ✦</h2>
			<ul>
				{#each exhibits as exhibit}
					<li>
						<span>{exhibit.title}</span>
						{#if exhibit.detail}
							— {exhibit.detail}
						{/if}
					</li>
				{/each}
				<li class="accent about__accent"><a href="/contact">you</a>? 💫</li>
			</ul>
		</article>

		<article class="info-card about__info-card" aria-labelledby="clients-title">
			<h2 id="clients-title" class="section-label about__section-label">Selected Clients ✦</h2>
			<ul>
				{#each clients as client}
					<li>{client}</li>
				{/each}
				<li class="accent about__accent"><a href="/contact">you</a>? 🌈</li>
			</ul>
		</article>
	</section>

	<section class="services about__services" aria-labelledby="services-title">
		<p class="section-label about__section-label">What I Build ✦</p>
		<h2 id="services-title" class="services-heading about__services-heading">Sketch.IO crafts tools for people who love making things.</h2>
		<div class="services-grid about__services-grid">
			{#each services as service}
				<article class="service-item about__service-item">
					<div class="icon about__icon" aria-hidden="true">{service.icon}</div>
					<h3>{service.name}</h3>
					<p>{service.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="cta about__cta" aria-labelledby="cta-title">
		<div class="cta-box about__cta-box">
			<h2 id="cta-title">Let's make something magical together <span aria-hidden="true">✨</span></h2>
			<p>A creative tool, an interactive exhibit, or a wild idea you can't quite describe yet.</p>
			<a href="/contact">Say Haai</a>
		</div>
	</section>
</div>
