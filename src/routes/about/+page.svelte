<script>
	import './About.scss'
	import { ArrowUpRight, BriefcaseBusiness, Music2, Paintbrush2, Sparkles } from '@lucide/svelte'
</script>

<svelte:head>
	<title>About - MIKO.ART</title>
	<meta
		name="description"
		content="About Miko: founder, product builder, and creative technologist behind colorful tools and experiences."
	/>
</svelte:head>

<div class="about-page">
	<section class="about-hero">
		<p class="kicker">
			<Sparkles size={14} strokeWidth={2.2} />
			<span>About</span>
		</p>
		<h1>Hi, I’m Miko.</h1>
		<p class="subtitle">I build colorful software that helps people make things.</p>
	</section>

	<section class="about-grid">
		<article class="story-card">
			<p>
				I’m a founder, developer, and designer focused on products where creativity and usability can live in the
				same room. I care about software that feels expressive, but still gets out of your way.
			</p>
			<p>
				I’m currently Founder and CTO at
				<a href="https://sketch.io/" target="_blank" rel="noopener noreferrer">Sketch.IO</a>, where we make
				<a href="https://sketchpad.com/" target="_blank" rel="noopener noreferrer">Sketchpad</a> and other design
				tools used by students, teachers, creators, and teams around the world.
			</p>
			<p>
				Before that, I co-founded Portlandia Foods (acquired in 2023) and Lyrics Freak (acquired in 2010). Across
				all of it, the through-line has stayed the same: build useful things with personality.
			</p>
		</article>

		<aside class="profile-card" aria-label="Miko profile">
			<img src="/media/miko.jpg" alt="Miko" class="miko-photo" width="360" />
			<div class="profile-meta">
				<p><BriefcaseBusiness size={14} strokeWidth={2.2} /> Founder + CTO, Sketch.IO</p>
				<p><Paintbrush2 size={14} strokeWidth={2.2} /> Product Design + Creative Tools</p>
				<p><Music2 size={14} strokeWidth={2.2} /> Developer, Designer, Musician</p>
			</div>
		</aside>
	</section>

	<section class="panel">
		<h2>Selected Exhibits</h2>
		<ul>
			<li>Art Gallery of Ontario, Illusions Exhibition</li>
			<li>Dubai Union Metro, Art in Transit</li>
			<li>Google I/O 2010, Darkroom</li>
			<li>Google I/O 2012, Sketch Mobile</li>
			<li>Google I/O 2013, Webcam FX</li>
			<li>Mackinac State Historic Parks</li>
			<li>Tel Aviv Museum of Modern Art</li>
		</ul>
	</section>

	<section class="panel two-col">
		<div>
			<h2>Selected Clients</h2>
			<ul>
				<li>AAA</li>
				<li>ABCya Games</li>
				<li>Draw It To Know It (Medical + Biological Sciences)</li>
				<li>Google, Made With Code</li>
				<li>Jo Malone London</li>
				<li>Los Alamos National Laboratory</li>
				<li>Portland Timbers, RCTID</li>
				<li>Scotties</li>
				<li>Travel Portland</li>
				<li>Upworthy</li>
			</ul>
		</div>
		<div>
			<h2>What I Build</h2>
			<ul>
				<li>Educational and musical creative apps</li>
				<li>Non-destructive illustration and painting tools</li>
				<li>Collaborative realtime creative workflows</li>
				<li>Kiosk software for science and learning centers</li>
				<li>Interactive experiences for sports and media campaigns</li>
				<li>Customization tools for print and commerce</li>
			</ul>
		</div>
	</section>

	<section class="closing">
		<p>
			If you’re building something thoughtful and a little unusual, I’m always happy to connect.
		</p>
		<a href="/contact" class="contact-link">
			<span>Start a conversation</span>
			<ArrowUpRight size={15} strokeWidth={2.2} />
		</a>
	</section>
</div>
