<script>
	import './About.scss'
	import HeroBanner from '@components/HeroBanner.svelte'
</script>

<svelte:head>
	<title>About - MIKO.ART</title>
	<meta
		name="description"
		content="About Miko: founder, product builder, and creative technologist behind colorful tools and experiences."
	/>
</svelte:head>

<HeroBanner
	title="Haai! I'm Miko"
	subtitle="Developer, designer & musician :)"
	icon="/media/emoji-unicorn.png"
/>

<div class="about-page">
	<article class="about-article">
		<figure class="portrait">
			<img src="/media/miko.jpg" alt="Miko" width="420" />
		</figure>

		<section class="intro">
			<p>
				I’m passionate about creating colorful, creative & educational applications!
			</p>
			<p>
				Founder & CTO of
				<a href="https://sketch.io/" target="_blank" rel="noopener noreferrer">Sketch.IO</a>, where we make
				<a href="https://sketchpad.com/" target="_blank" rel="noopener noreferrer">Sketchpad</a> 🎨
			</p>
			<p>
				Co-Founder of
				<a href="https://portlandiafoods.com/" target="_blank" rel="noopener noreferrer">Portlandia Foods</a>
				creators of Portland Ketchup 🪴 (acquired 2023)
			</p>
			<p>
				Co-Founder of <a href="https://lyricsfreak.com/" target="_blank" rel="noopener noreferrer">Lyrics Freak</a> 🎵 (acquired 2010)
			</p>
		</section>

		<section class="section">
			<h2>Exhibits, Selected</h2>
			<ul>
				<li>Art Gallery of Ontario, Illusions Exhibition</li>
				<li>Dubai Union Metro, Art in Transit</li>
				<li>Google I/O 2010, Darkroom</li>
				<li>Google I/O 2012, Sketch Mobile</li>
				<li>Google I/O 2013, Webcam FX</li>
				<li>Mackinac State Historic Parks</li>
				<li>Tel Aviv Museum of Modern Art</li>
				<li>...you?</li>
			</ul>
		</section>

		<section class="section">
			<h2>Clients, Selected</h2>
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
				<li>...you?</li>
			</ul>
		</section>

		<section class="section">
			<h2>Sketch.IO specializes in creating a diverse range of design tools:</h2>
			<ul>
				<li>
					<strong>Annotations & Editing for Online News:</strong>
					Innovative tools designed to enhance the digital news experience with user-friendly annotations and editing capabilities.
				</li>
				<li>
					<strong>Colorful Educational Musical Apps:</strong>
					Interactive and vibrant applications that fuse music with learning, making education both fun and engaging for all ages.
				</li>
				<li>
					<strong>Kiosk Software for Science & Learning Centers:</strong>
					Cutting-edge interactive kiosk software, bringing digital innovation to science and educational environments.
				</li>
				<li>
					<strong>Non-Destructive Illustration & Painting Apps:</strong>
					Sophisticated apps offering artists and designers the freedom to create with non-destructive editing tools.
				</li>
				<li>
					<strong>Promotional Contests for Sports Teams & Companies:</strong>
					Tailored contest platforms to boost engagement for sports teams and businesses, driving promotional success.
				</li>
				<li>
					<strong>Realtime Collaborative Apps:</strong>
					Dynamic applications enabling seamless collaboration in real-time, enhancing teamwork and productivity.
				</li>
				<li>
					<strong>User-Based Product Customization for Printing:</strong>
					Flexible design tools that allow users to personalize products, perfect for creating unique print-on-demand items.
				</li>
			</ul>
		</section>

		<footer class="closing"></footer>
	</article>
</div>
