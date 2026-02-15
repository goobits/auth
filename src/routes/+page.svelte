<script lang="ts">
	import {
		Mail,
		ChevronDown,
		ArrowDown,
		Heart,
		Users,
		Building2,
		Check,
		Droplets,
		Sun
	} from 'lucide-svelte';

	let email = $state('');

	// FAQ state management
	let openFaqIndex = $state<number | null>(null);

	function toggleFaq(index: number) {
		openFaqIndex = openFaqIndex === index ? null : index;
	}

	const scheduleItems = [
		{
			num: '1',
			subtitle: 'The Arrival',
			title: 'Dino Migration Ride',
			emoji: '🚲',
			desc: 'Costume-friendly group bike ride ending at Mt. Tabor. Meet-up location announced closer to the date.',
			distance: 'Route TBA'
		},
		{
			num: '2',
			subtitle: 'The Stampede',
			title: 'Tabor Dino Dash',
			emoji: '🦖',
			desc: "A fun run through the park with 'herd pace'—meaning run, jog, walk, or stomp. Nobody gets left behind.",
			distance: '~2 mi loop'
		},
		{
			num: '3',
			subtitle: 'The Rest',
			title: 'Creature Comfort Yoga',
			emoji: '🧘',
			desc: "Animal-inspired stretching on the lawn. Downward dog, cobra, 'happy pterodactyl.' Bring a mat or towel.",
			distance: '~30 min'
		},
		{
			num: '4',
			subtitle: 'The Finale',
			title: 'Sky Dinos Aerial',
			emoji: '✨',
			desc: 'A short aerial silks performance to close out the day. Donation-based—tips go directly to performers.',
			distance: '~20 min'
		}
	];

	const essentials = [
		'Comfortable shoes (run or walk)',
		'Water bottle (stay hydrated!)',
		'Sunscreen & a light layer',
		'Yoga mat or towel',
		'Bike + helmet (if riding in)',
		'Cash/phone for donations'
	];

	const dressCodes = [
		'🌺 Hawaiian shirts',
		'🦖 Dino costumes',
		'🐆 Animal print',
		'🌿 Leafy green',
		'✨ Glitter optional'
	];

	const faqs = [
		{
			q: 'Do I need to register?',
			a: "Registration details coming soon. We're keeping it simple and friendly—no complicated signups."
		},
		{
			q: 'Is it really free?',
			a: 'Yes! Free to attend. Donations are welcome, and the aerial show is tip-based with contributions going directly to performers.'
		},
		{
			q: 'Is this a race?',
			a: "Nope, it's a fun run with 'herd pace.' Run, jog, walk, or stomp—all speeds welcome."
		},
		{
			q: 'Can kids come?',
			a: 'Absolutely! Family-friendly vibes throughout. Young dinos especially welcome.'
		},
		{
			q: 'What if it rains?',
			a: "We're optimistic about Portland in August. We'll post updates if weather changes plans."
		},
		{
			q: 'Where exactly in Mt. Tabor?',
			a: 'Specific meet-up points will be shared once we have our park permit confirmed.'
		}
	];

	const stats = [
		{ n: 'FREE', l: 'Entry' },
		{ n: '4', l: 'Activities' },
		{ n: 'ALL', l: 'Paces' },
		{ n: '1', l: 'Volcano' }
	];
</script>

<div class="dino-day">
	<!-- Top Bar -->
	<div class="dino-day__topbar">
		<div class="dino-day__topbar-content">
			<span class="dino-day__topbar-title">DINO DAY 2026</span>
			<span class="dino-day__topbar-location">Mt. Tabor · Portland</span>
		</div>
	</div>

	<!-- Hero Section -->
	<section class="dino-day__hero">
		<div class="dino-day__hero-bg">
			<!-- Topo Lines SVG -->
			<svg viewBox="0 0 400 300" class="dino-day__topo" preserveAspectRatio="none">
				<defs>
					<pattern id="topo" width="400" height="300" patternUnits="userSpaceOnUse">
						{#each Array(12) as _, i}
							<ellipse
								cx="200"
								cy="150"
								rx={180 - i * 14}
								ry={120 - i * 9}
								fill="none"
								stroke="currentColor"
								stroke-width="1"
								opacity={0.15 - i * 0.01}
							/>
						{/each}
					</pattern>
				</defs>
				<rect width="400" height="300" fill="url(#topo)" />
			</svg>
		</div>

		<div class="dino-day__hero-container">
			<div class="dino-day__hero-grid">
				<div class="dino-day__hero-content">
					<div class="dino-day__hero-stamps">
						<span class="dino-day__stamp dino-day__stamp--outline">Free Event</span>
						<span class="dino-day__stamp dino-day__stamp--solid">Costumes Welcome</span>
					</div>

					<h1 class="dino-day__hero-title">
						DINO<span class="dino-day__hero-title--accent"> DAY</span>
					</h1>

					<p class="dino-day__hero-subtitle">Mt. Tabor Park · Portland · August 2026</p>

					<p class="dino-day__hero-desc">
						A community celebration: bike ride, fun run, yoga & aerial arts. Hawaiian shirts
						encouraged. Dinosaur costumes even better.
					</p>

					<div class="dino-day__hero-form">
						<input
							type="email"
							placeholder="your@email.com"
							bind:value={email}
							class="dino-day__hero-input"
						/>
						<button class="dino-day__hero-button">
							<Mail size={16} />
							Notify Me
						</button>
					</div>
				</div>

				<div class="dino-day__hero-dino">
					<!-- Tabor Dino SVG -->
					<svg viewBox="0 0 180 140" class="dino-day__dino-svg">
						<!-- Shadow -->
						<ellipse cx="90" cy="132" rx="50" ry="8" fill="#1E3A2F" opacity="0.1" />
						<!-- Tail -->
						<path d="M25 75 Q5 60 15 80 Q5 95 30 90" fill="#2D5A3D" />
						<path d="M28 78 Q15 70 22 82" fill="#3D6B4A" />
						<!-- Back leg -->
						<path
							d="M55 95 L50 120 Q48 128 55 128 L65 128 Q70 128 68 120 L65 100"
							fill="#2D5A3D"
						/>
						<!-- Body -->
						<ellipse cx="85" cy="75" rx="45" ry="35" fill="#2D5A3D" />
						<!-- Belly -->
						<ellipse cx="90" cy="85" rx="30" ry="22" fill="#3D6B4A" />
						<!-- Front leg -->
						<path
							d="M105 90 L102 118 Q100 126 107 126 L117 126 Q122 126 120 118 L115 95"
							fill="#2D5A3D"
						/>
						<!-- Hawaiian shirt pattern -->
						<circle cx="70" cy="70" r="5" fill="#E85A3D" opacity="0.9" />
						<circle cx="85" cy="62" r="4" fill="#F4A259" opacity="0.9" />
						<circle cx="100" cy="72" r="5" fill="#E85A3D" opacity="0.9" />
						<circle cx="78" cy="82" r="3" fill="#F4A259" opacity="0.9" />
						<circle cx="95" cy="85" r="4" fill="#E85A3D" opacity="0.9" />
						<!-- Flower details -->
						<circle cx="70" cy="70" r="2" fill="#FDF3E7" />
						<circle cx="100" cy="72" r="2" fill="#FDF3E7" />
						<!-- Arm -->
						<ellipse cx="115" cy="70" rx="6" ry="12" fill="#3D6B4A" transform="rotate(20 115 70)" />
						<path d="M118 58 L125 52" stroke="#3D6B4A" stroke-width="4" stroke-linecap="round" />
						<!-- Neck -->
						<path
							d="M115 60 Q130 45 140 35"
							stroke="#2D5A3D"
							stroke-width="20"
							stroke-linecap="round"
							fill="none"
						/>
						<!-- Head -->
						<ellipse cx="148" cy="30" rx="22" ry="18" fill="#2D5A3D" />
						<!-- Snout -->
						<ellipse cx="165" cy="33" rx="12" ry="9" fill="#3D6B4A" />
						<!-- Nostril -->
						<circle cx="172" cy="31" r="2" fill="#1E3A2F" />
						<!-- Eye white -->
						<ellipse cx="150" cy="24" rx="8" ry="9" fill="#FDF3E7" />
						<!-- Eye -->
						<circle cx="152" cy="24" r="5" fill="#1E3A2F" />
						<circle cx="154" cy="22" r="2" fill="#FDF3E7" />
						<!-- Smile -->
						<path
							d="M160 40 Q167 45 172 42"
							stroke="#1E3A2F"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
						/>
						<!-- Rosy cheek -->
						<ellipse cx="158" cy="38" rx="4" ry="3" fill="#E85A3D" opacity="0.4" />
						<!-- Spikes -->
						<path d="M115 48 L118 38 L125 50 L130 35 L138 48" fill="#F4A259" />
						<path d="M60 45 L65 30 L75 45 L82 28 L92 42 L100 30 L108 45" fill="#F4A259" />
						<!-- Tiny arm wave lines -->
						<path
							d="M128 48 L132 45 M130 52 L135 50"
							stroke="#2D5A3D"
							stroke-width="2"
							stroke-linecap="round"
							opacity="0.5"
						/>
					</svg>
				</div>
			</div>
		</div>

		<!-- Tabor Silhouette -->
		<div class="dino-day__hero-silhouette">
			<svg viewBox="0 0 400 120" preserveAspectRatio="none">
				<path
					d="M0 120 L0 80 Q50 70 100 60 Q150 45 200 40 Q250 45 300 55 Q350 65 400 75 L400 120 Z"
					fill="#1E3A2F"
					opacity="0.1"
				/>
				<path
					d="M80 65 L85 50 L90 65 M150 48 L155 35 L160 48 M220 45 L225 30 L230 45 M290 52 L295 40 L300 52"
					stroke="#1E3A2F"
					stroke-width="3"
					opacity="0.15"
					stroke-linecap="round"
				/>
				<ellipse cx="200" cy="55" rx="25" ry="8" fill="#4A90A4" opacity="0.2" />
			</svg>
		</div>
	</section>

	<!-- About Section -->
	<section class="dino-day__about">
		<div class="dino-day__about-container">
			<p class="dino-day__about-label">The Idea</p>
			<h2 class="dino-day__about-title">A tiny festival of movement at an extinct volcano</h2>
			<p class="dino-day__about-desc">
				We ride bikes to Mt. Tabor dressed like dinosaurs. We run (or walk) together through the
				park. We stretch. We watch humans fly on aerial silks. We go home happy. That's it.
			</p>

			<div class="dino-day__about-stats">
				{#each stats as stat}
					<div class="dino-day__about-stat">
						<div class="dino-day__about-stat-value">{stat.n}</div>
						<div class="dino-day__about-stat-label">{stat.l}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Schedule Section -->
	<section class="dino-day__schedule">
		<div class="dino-day__schedule-container">
			<div class="dino-day__schedule-header">
				<p class="dino-day__schedule-label">Trail Guide</p>
				<h2 class="dino-day__schedule-title">THE ROUTE</h2>
			</div>

			<div class="dino-day__schedule-list">
				{#each scheduleItems as item, i}
					<div class="dino-day__trail-marker" class:dino-day__trail-marker--last={i === scheduleItems.length - 1}>
						<div class="dino-day__trail-marker-post">
							<div class="dino-day__trail-marker-num">{item.num}</div>
							<div class="dino-day__trail-marker-line"></div>
						</div>
						<div class="dino-day__trail-marker-content">
							<div class="dino-day__trail-marker-card">
								<div class="dino-day__trail-marker-top">
									<div>
										<p class="dino-day__trail-marker-subtitle">{item.subtitle}</p>
										<h3 class="dino-day__trail-marker-title">{item.title} {item.emoji}</h3>
									</div>
									{#if item.distance}
										<span class="dino-day__trail-marker-distance">{item.distance}</span>
									{/if}
								</div>
								<p class="dino-day__trail-marker-desc">{item.desc}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<p class="dino-day__schedule-note">Exact times posted after park permit is confirmed</p>
		</div>
	</section>

	<!-- Pack List Section -->
	<section class="dino-day__packlist">
		<div class="dino-day__packlist-container">
			<div class="dino-day__packlist-header">
				<p class="dino-day__packlist-label">Preparation</p>
				<h2 class="dino-day__packlist-title">PACK LIST</h2>
			</div>

			<div class="dino-day__packlist-grid">
				<div class="dino-day__packlist-essentials">
					<h3 class="dino-day__packlist-section-title">
						<span class="dino-day__packlist-icon">✓</span>
						Essentials
					</h3>
					<ul class="dino-day__packlist-list">
						{#each essentials as item}
							<li class="dino-day__packlist-item">
								<Check size={16} class="dino-day__packlist-check" />
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>

				<div class="dino-day__packlist-dresscode">
					<h3 class="dino-day__packlist-section-title dino-day__packlist-section-title--light">
						<span class="dino-day__packlist-icon dino-day__packlist-icon--star">★</span>
						Dress Code: Jungle Dino Vacation
					</h3>
					<div class="dino-day__packlist-tags">
						{#each dressCodes as code}
							<span class="dino-day__packlist-tag">{code}</span>
						{/each}
					</div>
					<p class="dino-day__packlist-note">
						No costume? No problem. Regular clothes are 100% welcome. This is a judgment-free zone.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Charity Section -->
	<section class="dino-day__charity">
		<div class="dino-day__charity-container">
			<Heart size={48} class="dino-day__charity-icon" />
			<h2 class="dino-day__charity-title">SUPPORTING YOUNG EXPLORERS</h2>
			<p class="dino-day__charity-desc">
				We're working to make this a charity event supporting
				<strong>OMSI youth education</strong>—because dinosaurs have always been science's gateway
				joy.
			</p>
			<p class="dino-day__charity-note">Details on donation logistics coming soon.</p>
			<button class="dino-day__charity-button">Learn About OMSI →</button>
		</div>

		<div class="dino-day__charity-dino dino-day__charity-dino--left">
			<svg viewBox="0 0 180 140">
				<ellipse cx="90" cy="132" rx="50" ry="8" fill="currentColor" opacity="0.3" />
				<ellipse cx="85" cy="75" rx="45" ry="35" fill="currentColor" />
				<ellipse cx="148" cy="30" rx="22" ry="18" fill="currentColor" />
				<path d="M115 60 Q130 45 140 35" stroke="currentColor" stroke-width="20" fill="none" />
			</svg>
		</div>
		<div class="dino-day__charity-dino dino-day__charity-dino--right">
			<svg viewBox="0 0 180 140">
				<ellipse cx="90" cy="132" rx="50" ry="8" fill="currentColor" opacity="0.3" />
				<ellipse cx="85" cy="75" rx="45" ry="35" fill="currentColor" />
				<ellipse cx="148" cy="30" rx="22" ry="18" fill="currentColor" />
				<path d="M115 60 Q130 45 140 35" stroke="currentColor" stroke-width="20" fill="none" />
			</svg>
		</div>
	</section>

	<!-- Get Involved Section -->
	<section class="dino-day__involved">
		<div class="dino-day__involved-container">
			<div class="dino-day__involved-header">
				<p class="dino-day__involved-label">Join Us</p>
				<h2 class="dino-day__involved-title">GET INVOLVED</h2>
			</div>

			<div class="dino-day__involved-grid">
				<div class="dino-day__involved-card dino-day__involved-card--volunteer">
					<Users size={40} class="dino-day__involved-icon" />
					<h3 class="dino-day__involved-card-title">Volunteer</h3>
					<p class="dino-day__involved-card-desc">
						We need friendly humans for check-in, route support, cheering, and general dino
						wrangling.
					</p>
					<button class="dino-day__involved-button dino-day__involved-button--outline">
						Sign Up →
					</button>
				</div>

				<div class="dino-day__involved-card dino-day__involved-card--sponsor">
					<Building2 size={40} class="dino-day__involved-icon" />
					<h3 class="dino-day__involved-card-title">Sponsor</h3>
					<p class="dino-day__involved-card-desc">
						Local business? Help with snacks, water, permits, or swag. Small contributions = big
						gratitude.
					</p>
					<button class="dino-day__involved-button dino-day__involved-button--solid">
						Let's Talk →
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- FAQ Section -->
	<section class="dino-day__faq">
		<div class="dino-day__faq-container">
			<div class="dino-day__faq-header">
				<h2 class="dino-day__faq-title">QUESTIONS</h2>
			</div>

			<div class="dino-day__faq-list">
				{#each faqs as faq, i}
					<div class="dino-day__faq-item" class:dino-day__faq-item--last={i === faqs.length - 1}>
						<button class="dino-day__faq-question" onclick={() => toggleFaq(i)}>
							<span
								class="dino-day__faq-icon"
								class:dino-day__faq-icon--active={openFaqIndex === i}>?</span
							>
							<span class="dino-day__faq-q">{faq.q}</span>
						</button>
						<div class="dino-day__faq-answer" class:dino-day__faq-answer--open={openFaqIndex === i}>
							<p class="dino-day__faq-a">{faq.a}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="dino-day__footer">
		<div class="dino-day__footer-container">
			<div class="dino-day__footer-top">
				<div class="dino-day__footer-brand">
					<div class="dino-day__footer-logo">
						<span class="dino-day__footer-emoji">🦖</span>
						<span class="dino-day__footer-name">DINO DAY</span>
					</div>
					<p class="dino-day__footer-location">Mt. Tabor Park · Portland, OR · August 2026</p>
				</div>

				<div class="dino-day__footer-contact">
					<p class="dino-day__footer-contact-label">Questions?</p>
					<p class="dino-day__footer-email">hello@dinoday.example</p>
				</div>
			</div>

			<div class="dino-day__footer-bottom">
				<p>Made with 🦖 in Portland</p>
				<p>Subject to permitting · Not responsible for excessive roaring</p>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(*) { margin: 0; padding: 0; box-sizing: border-box; }
	:global(body) { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
	:global(:root) {
		--color-cream: #fdf3e7;
		--color-cream-dark: #e8e4dd;
		--color-forest: #1e3a2f;
		--color-forest-light: #2d5a3d;
		--color-coral: #e85a3d;
		--color-gold: #f4a259;
		--color-water: #4a90a4;
	}

	/* Base */
	.dino-day { min-height: 100vh; background-color: var(--color-cream); color: var(--color-forest); font-family: system-ui, -apple-system, sans-serif; }

	/* Top Bar */
	.dino-day__topbar { background-color: var(--color-forest); color: var(--color-cream); padding: 0.75rem 1.5rem; }
	.dino-day__topbar-content { max-width: 64rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
	.dino-day__topbar-title { font-weight: 700; letter-spacing: 0.05em; font-size: 0.875rem; }
	.dino-day__topbar-location { font-size: 0.875rem; opacity: 0.6; }

	/* Stamps */
	.dino-day__stamp { display: inline-block; padding: 0.375rem 0.75rem; font-weight: 900; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
	.dino-day__stamp--outline { border: 3px solid var(--color-coral); color: var(--color-coral); transform: rotate(-2deg); }
	.dino-day__stamp--solid { background-color: var(--color-coral); color: var(--color-cream); transform: rotate(3deg); }

	/* Hero */
	.dino-day__hero { min-height: 90vh; position: relative; display: flex; align-items: center; padding: 4rem 1.5rem; overflow: hidden; }
	.dino-day__hero-bg { position: absolute; inset: 0; color: var(--color-forest); }
	.dino-day__hero-container { max-width: 64rem; margin: 0 auto; width: 100%; position: relative; z-index: 10; }
	.dino-day__hero-grid { display: grid; gap: 2rem; align-items: center; }
	.dino-day__hero-stamps { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
	.dino-day__hero-title { font-size: 15vw; font-weight: 900; line-height: 0.85; letter-spacing: -0.02em; margin-bottom: 1rem; }
	.dino-day__hero-title--accent { color: var(--color-coral); }
	.dino-day__hero-subtitle { font-size: 1.25rem; font-weight: 700; opacity: 0.6; margin-bottom: 1.5rem; }
	.dino-day__hero-desc { font-size: 1.125rem; max-width: 28rem; margin-bottom: 2rem; line-height: 1.6; }
	.dino-day__hero-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
	.dino-day__hero-input { flex-grow: 1; padding: 0.75rem 1rem; border: 2px solid var(--color-forest); background-color: rgba(255, 255, 255, 0.5); backdrop-filter: blur(4px); font-weight: 500; }
	.dino-day__hero-input:focus { outline: none; background-color: white; }
	.dino-day__hero-button { padding: 0.75rem 1.5rem; background-color: var(--color-forest); color: var(--color-cream); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; cursor: pointer; transition: background-color 0.2s; }
	.dino-day__hero-button:hover { background-color: var(--color-coral); }
	.dino-day__hero-dino { display: flex; justify-content: center; }
	.dino-day__hero-silhouette { position: absolute; bottom: 0; left: 0; right: 0; }
	.dino-day__hero-silhouette svg { width: 100%; height: 6rem; }
	.dino-day__topo { width: 100%; height: 100%; }
	.dino-day__dino-svg { width: 18rem; }

	/* About */
	.dino-day__about { padding: 5rem 1.5rem; background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__about-container { max-width: 48rem; margin: 0 auto; text-align: center; }
	.dino-day__about-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5; margin-bottom: 1rem; }
	.dino-day__about-title { font-size: 1.875rem; font-weight: 900; margin-bottom: 1.5rem; line-height: 1.2; }
	.dino-day__about-desc { font-size: 1.125rem; opacity: 0.8; line-height: 1.6; margin-bottom: 2.5rem; }
	.dino-day__about-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; max-width: 32rem; margin: 0 auto; }
	.dino-day__about-stat { text-align: center; }
	.dino-day__about-stat-value { font-size: 1.5rem; font-weight: 900; color: var(--color-gold); }
	.dino-day__about-stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; }

	/* Schedule */
	.dino-day__schedule { padding: 5rem 1.5rem; }
	.dino-day__schedule-container { max-width: 42rem; margin: 0 auto; }
	.dino-day__schedule-header { text-align: center; margin-bottom: 3rem; }
	.dino-day__schedule-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5; margin-bottom: 0.5rem; }
	.dino-day__schedule-title { font-size: 2.25rem; font-weight: 900; }
	.dino-day__schedule-note { text-align: center; font-size: 0.875rem; opacity: 0.4; margin-top: 1rem; }

	/* Trail Marker */
	.dino-day__trail-marker { display: flex; gap: 1rem; }
	.dino-day__trail-marker-post { display: flex; flex-direction: column; align-items: center; }
	.dino-day__trail-marker-num { width: 3rem; height: 3rem; background-color: var(--color-forest); color: var(--color-cream); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.125rem; }
	.dino-day__trail-marker-line { width: 0.25rem; flex-grow: 1; background-color: var(--color-forest); opacity: 0.2; }
	.dino-day__trail-marker--last .dino-day__trail-marker-line { display: none; }
	.dino-day__trail-marker-content { padding-bottom: 2rem; flex-grow: 1; }
	.dino-day__trail-marker-card { background-color: var(--color-cream); border: 2px solid var(--color-forest); padding: 1.25rem; transition: all 0.2s; }
	.dino-day__trail-marker-card:hover { background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__trail-marker-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; }
	.dino-day__trail-marker-subtitle { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; margin-bottom: 0.25rem; }
	.dino-day__trail-marker-title { font-size: 1.25rem; font-weight: 900; }
	.dino-day__trail-marker-distance { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; white-space: nowrap; }
	.dino-day__trail-marker-desc { opacity: 0.7; font-size: 0.875rem; line-height: 1.6; }

	/* Pack List */
	.dino-day__packlist { padding: 5rem 1.5rem; background-color: var(--color-cream-dark); }
	.dino-day__packlist-container { max-width: 56rem; margin: 0 auto; }
	.dino-day__packlist-header { text-align: center; margin-bottom: 3rem; }
	.dino-day__packlist-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5; margin-bottom: 0.5rem; }
	.dino-day__packlist-title { font-size: 2.25rem; font-weight: 900; }
	.dino-day__packlist-grid { display: grid; gap: 2rem; }
	.dino-day__packlist-essentials { background-color: var(--color-cream); border: 2px solid var(--color-forest); padding: 1.5rem; }
	.dino-day__packlist-dresscode { background-color: var(--color-forest); color: var(--color-cream); padding: 1.5rem; }
	.dino-day__packlist-section-title { font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.875rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
	.dino-day__packlist-section-title--light { color: var(--color-cream); }
	.dino-day__packlist-icon { width: 1.5rem; height: 1.5rem; background-color: var(--color-forest); color: var(--color-cream); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; }
	.dino-day__packlist-icon--star { background-color: var(--color-gold); color: var(--color-forest); }
	.dino-day__packlist-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
	.dino-day__packlist-item { display: flex; align-items: flex-start; gap: 0.75rem; }
	.dino-day__packlist-check { color: var(--color-coral); flex-shrink: 0; margin-top: 0.25rem; }
	.dino-day__packlist-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
	.dino-day__packlist-tag { background-color: rgba(253, 243, 231, 0.1); padding: 0.375rem 0.75rem; font-size: 0.875rem; }
	.dino-day__packlist-note { font-size: 0.875rem; opacity: 0.6; }

	/* Charity */
	.dino-day__charity { padding: 5rem 1.5rem; background-color: var(--color-coral); color: var(--color-cream); position: relative; overflow: hidden; }
	.dino-day__charity-container { max-width: 48rem; margin: 0 auto; text-align: center; position: relative; z-index: 10; }
	.dino-day__charity-icon { margin: 0 auto 1rem; opacity: 0.8; display: block; }
	.dino-day__charity-title { font-size: 1.875rem; font-weight: 900; margin-bottom: 1rem; }
	.dino-day__charity-desc { font-size: 1.125rem; opacity: 0.9; max-width: 36rem; margin: 0 auto 0.75rem; line-height: 1.6; }
	.dino-day__charity-note { font-size: 0.875rem; opacity: 0.7; margin-bottom: 2rem; }
	.dino-day__charity-button { padding: 0.75rem 1.5rem; background-color: var(--color-cream); color: var(--color-forest); font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; }
	.dino-day__charity-button:hover { background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__charity-dino { position: absolute; bottom: 0; opacity: 0.1; }
	.dino-day__charity-dino svg { width: 8rem; }
	.dino-day__charity-dino--left { left: 1rem; }
	.dino-day__charity-dino--right { right: 1rem; transform: scaleX(-1); }
	.dino-day__charity-dino--right svg { width: 6rem; }

	/* Get Involved */
	.dino-day__involved { padding: 5rem 1.5rem; }
	.dino-day__involved-container { max-width: 56rem; margin: 0 auto; }
	.dino-day__involved-header { text-align: center; margin-bottom: 3rem; }
	.dino-day__involved-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5; margin-bottom: 0.5rem; }
	.dino-day__involved-title { font-size: 2.25rem; font-weight: 900; }
	.dino-day__involved-grid { display: grid; gap: 1.5rem; }
	.dino-day__involved-card { padding: 2rem; transition: all 0.2s; }
	.dino-day__involved-card--volunteer { border: 2px solid var(--color-forest); }
	.dino-day__involved-card--volunteer:hover { background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__involved-card--sponsor { background-color: var(--color-gold); }
	.dino-day__involved-card--sponsor:hover { background-color: var(--color-coral); }
	.dino-day__involved-card-title { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.5rem; }
	.dino-day__involved-card-desc { opacity: 0.7; margin-bottom: 1.5rem; }
	.dino-day__involved-icon { margin-bottom: 1rem; }
	.dino-day__involved-button { padding: 0.5rem 1.25rem; font-weight: 700; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; border: none; cursor: pointer; transition: all 0.2s; }
	.dino-day__involved-button--outline { border: 2px solid currentColor; background: transparent; color: inherit; }
	.dino-day__involved-card--volunteer:hover .dino-day__involved-button--outline { background-color: var(--color-cream); color: var(--color-forest); }
	.dino-day__involved-button--solid { background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__involved-button--solid:hover { background-color: var(--color-cream); color: var(--color-forest); }

	/* FAQ */
	.dino-day__faq { padding: 5rem 1.5rem; background-color: var(--color-cream-dark); }
	.dino-day__faq-container { max-width: 42rem; margin: 0 auto; }
	.dino-day__faq-header { text-align: center; margin-bottom: 2.5rem; }
	.dino-day__faq-title { font-size: 2.25rem; font-weight: 900; }
	.dino-day__faq-list { background-color: var(--color-cream); border: 2px solid var(--color-forest); padding: 1.5rem; }
	.dino-day__faq-item { border-bottom: 1px solid rgba(30, 58, 47, 0.2); }
	.dino-day__faq-item--last { border-bottom: none; }
	.dino-day__faq-question { width: 100%; padding: 1rem 0; display: flex; align-items: flex-start; gap: 0.75rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 1rem; color: inherit; font-family: inherit; }
	.dino-day__faq-icon { width: 1.5rem; height: 1.5rem; border: 2px solid var(--color-forest); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.875rem; flex-shrink: 0; margin-top: 0.125rem; transition: all 0.2s; }
	.dino-day__faq-icon--active { background-color: var(--color-forest); color: var(--color-cream); }
	.dino-day__faq-q { font-weight: 700; font-size: 1.125rem; }
	.dino-day__faq-answer { max-height: 0; overflow: hidden; transition: all 0.3s ease; }
	.dino-day__faq-answer--open { max-height: 10rem; padding-bottom: 1rem; }
	.dino-day__faq-a { padding-left: 2.25rem; opacity: 0.7; }

	/* Footer */
	.dino-day__footer { background-color: var(--color-forest); color: var(--color-cream); padding: 4rem 1.5rem; }
	.dino-day__footer-container { max-width: 56rem; margin: 0 auto; }
	.dino-day__footer-top { display: flex; flex-direction: column; gap: 2rem; }
	.dino-day__footer-logo { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
	.dino-day__footer-emoji { font-size: 1.875rem; }
	.dino-day__footer-name { font-size: 1.25rem; font-weight: 900; }
	.dino-day__footer-location { opacity: 0.5; font-size: 0.875rem; }
	.dino-day__footer-contact { font-size: 0.875rem; }
	.dino-day__footer-contact-label { opacity: 0.5; margin-bottom: 0.25rem; }
	.dino-day__footer-email { font-weight: 700; }
	.dino-day__footer-bottom { border-top: 1px solid rgba(253, 243, 231, 0.2); margin-top: 2.5rem; padding-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem; font-size: 0.75rem; opacity: 0.4; }

	/* Responsive */
	@media (min-width: 640px) {
		.dino-day__hero-title { font-size: 80px; }
		.dino-day__hero-subtitle { font-size: 1.5rem; }
		.dino-day__hero-desc { font-size: 1.25rem; }
		.dino-day__hero-form { flex-direction: row; }
		.dino-day__dino-svg { width: 20rem; }
		.dino-day__about-title { font-size: 2.25rem; }
		.dino-day__about-desc { font-size: 1.25rem; }
		.dino-day__about-stat-value { font-size: 1.875rem; }
		.dino-day__schedule-title { font-size: 3rem; }
		.dino-day__packlist-title { font-size: 3rem; }
		.dino-day__charity-title { font-size: 2.25rem; }
		.dino-day__charity-desc { font-size: 1.25rem; }
		.dino-day__involved-title { font-size: 3rem; }
		.dino-day__faq-title { font-size: 3rem; }
		.dino-day__footer-bottom { flex-direction: row; align-items: center; justify-content: space-between; }
	}

	@media (min-width: 768px) {
		.dino-day__packlist-grid { grid-template-columns: 1fr 1fr; }
		.dino-day__involved-grid { grid-template-columns: 1fr 1fr; }
		.dino-day__footer-top { flex-direction: row; align-items: center; justify-content: space-between; }
	}

	@media (min-width: 1024px) {
		.dino-day__hero-grid { grid-template-columns: 1fr 1fr; }
		.dino-day__hero-title { font-size: 100px; }
		.dino-day__hero-dino { justify-content: flex-end; }
		.dino-day__dino-svg { width: 400px; }
		.dino-day__about-title { font-size: 3rem; }
		.dino-day__charity-title { font-size: 3rem; }
	}
</style>
