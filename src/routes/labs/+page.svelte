<script>
	import { ArrowUpDown, ExternalLink, FlaskConical, Search, Sparkles } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const labs = [
		{ href: '/labs/color-galaxy', title: 'Color Galaxy', vibe: 'Generative color playground' },
		{ href: '/labs/js1k/BreathingGalaxies.html', title: 'JS1k - Breathing Galaxies', vibe: 'Tiny code, cosmic motion' },
		{ href: '/labs/js1k/Daltonize.html', title: 'JS1k - Daltonize', vibe: 'Color accessibility experiment' },
		{ href: '/labs/js1k/MicroSketchpad.html', title: 'JS1k - Micro Sketchpad', vibe: 'Pocket-sized drawing toy' },
		{ href: '/labs/js1k/SpectrumDJ.html', title: 'JS1k - Spectrum DJ', vibe: 'Music + visuals mashup' },
		{ href: '/labs/midi-js', title: 'MIDI.js', vibe: 'Browser MIDI tooling' },
		{ href: '/labs/sketch-js', title: 'Sketch.js', vibe: 'Creative coding toolkit' },
		{ href: '/labs/sketchpad-1.0', title: 'Sketchpad v1.0', vibe: 'Early product prototype' },
		{ href: '/labs/thumbnailer', title: 'Thumbnailer', vibe: 'Image utility experiment' },
		{ href: '/labs/zen-bg', title: 'Zen BG', vibe: 'Ambient background generator' }
	]

	function isExternalLab(href) {
		return href.endsWith('.html')
	}

	let searchQuery = $state('')
	let selectedScope = $state('all')
	let sortBy = $state('title')

	function matchesScope(lab) {
		if (selectedScope === 'external') return isExternalLab(lab.href)
		if (selectedScope === 'internal') return !isExternalLab(lab.href)
		return true
	}

	const filteredLabs = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase()

		const filtered = labs.filter((lab) => {
			if (!matchesScope(lab)) return false
			if (!query) return true
			return (
				lab.title.toLowerCase().includes(query) ||
				lab.href.toLowerCase().includes(query) ||
				lab.vibe.toLowerCase().includes(query)
			)
		})

		return filtered.sort((a, b) => {
			if (sortBy === 'path') return a.href.localeCompare(b.href)
			return a.title.localeCompare(b.title)
		})
	})
</script>

<svelte:head>
	<title>Labs - MIKO.ART</title>
</svelte:head>

<HeroBanner
	title="Labs"
	subtitle="Playful experiments, sketches, and odd ideas."
	icon="/media/emoji-labs.png"
/>

<div class="labs">
	<div class="tools" aria-label="Labs filters">
		<label class="search-field" aria-label="Search labs">
			<Search class="search-icon" size={15} strokeWidth={2.2} />
			<input type="text" placeholder="Search experiments..." bind:value={searchQuery} />
		</label>

		<div class="control-row">
			<div class="chips" role="tablist" aria-label="Scope filter">
				<button type="button" class:active={selectedScope === 'all'} onclick={() => (selectedScope = 'all')}>All</button>
				<button type="button" class:active={selectedScope === 'internal'} onclick={() => (selectedScope = 'internal')}>Internal</button>
				<button type="button" class:active={selectedScope === 'external'} onclick={() => (selectedScope = 'external')}>External</button>
			</div>

			<label class="sort-select">
				<ArrowUpDown size={13} strokeWidth={2.2} />
				<select bind:value={sortBy} aria-label="Sort labs">
					<option value="title">Name</option>
					<option value="path">Path</option>
				</select>
			</label>
		</div>
	</div>

	{#if filteredLabs.length === 0}
		<div class="no-results">
			<p>No experiments match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedScope = 'all'; sortBy = 'title' }}>Clear Filters</button>
		</div>
	{:else}
		<p class="results-count">{filteredLabs.length} experiments</p>

		<ul class="grid">
			{#each filteredLabs as lab, i}
				<li>
					<a href={lab.href} class="lab-card" style={`--i:${i % 6}`}>
						<p class="card-top">
							<span class="kind">
								<FlaskConical size={13} strokeWidth={2.2} />
								{isExternalLab(lab.href) ? 'Demo' : 'Lab'}
							</span>
							{#if isExternalLab(lab.href)}
								<ExternalLink size={14} strokeWidth={2.2} class="external" />
							{/if}
						</p>
						<h2>{lab.title}</h2>
						<p class="vibe">{lab.vibe}</p>
						<p class="path">{lab.href}</p>
						<p class="open">
							<span>Open experiment</span>
							<Sparkles size={13} strokeWidth={2.2} />
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.labs {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.tools {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1rem;
	}

	.search-field {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0 0.65rem;
		border: 1px solid var(--input-border);
		border-radius: 6px;
		background: var(--input-bg);
	}

	.search-icon {
		color: var(--muted);
		flex-shrink: 0;
	}

	input {
		width: 100%;
		padding: 0.52rem 0;
		font-size: 0.95rem;
		border: none;
		background: transparent;
		color: var(--text);
		margin-bottom: 0;
	}

	input:focus {
		outline: none;
	}

	.search-field:focus-within {
		border-color: var(--link);
	}

	.control-row {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		align-items: center;
	}

	.chips {
		display: inline-flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.chips button {
		padding: 0.25rem 0.62rem;
		font-size: 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--card-bg);
		color: var(--text);
		cursor: pointer;
	}

	.chips button.active {
		background: var(--brand-primary);
		color: var(--color-white);
		border-color: var(--brand-primary);
	}

	.sort-select {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.3rem 0.45rem;
		background: var(--card-bg);
		color: var(--muted);
	}

	select {
		border: none;
		background: transparent;
		color: var(--text);
		font-size: 0.85rem;
	}

	select:focus {
		outline: none;
	}

	.results-count {
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0 0 0.95rem;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
		gap: 0.9rem;
	}

	.lab-card {
		display: grid;
		gap: 0.52rem;
		padding: 0.9rem;
		min-height: 200px;
		text-decoration: none;
		color: var(--text);
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
		background:
			radial-gradient(circle at 105% -10%, color-mix(in srgb, var(--brand-primary) 14%, transparent) 0, transparent 45%),
			radial-gradient(circle at -10% 110%, color-mix(in srgb, var(--link) 11%, transparent) 0, transparent 40%),
			var(--card-bg);
		box-shadow: 0 6px 18px var(--shadow-softest);
		transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
	}

	.lab-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--link) 45%, var(--border));
		box-shadow: 0 12px 26px var(--shadow-softest);
	}

	.card-top {
		margin: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.kind {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		font-family: var(--font-sans);
		color: var(--muted);
	}

	.external {
		color: var(--muted);
	}

	.lab-card h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.05rem, 1.55vw, 1.4rem);
		font-weight: 500;
		line-height: 1.2;
	}

	.vibe {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
		font-family: var(--font-serif);
	}

	.path {
		margin: auto 0 0;
		font-family: monospace;
		font-size: 0.72rem;
		color: var(--muted);
		opacity: 0.95;
	}

	.open {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.78rem;
		font-weight: 600;
		font-family: var(--font-sans);
		color: var(--link);
	}

	.no-results {
		text-align: center;
		padding: 2rem;
		color: var(--muted);
	}

	.no-results button {
		margin-top: 0.75rem;
		padding: 0.4rem 0.75rem;
		background: var(--button-bg);
		color: var(--button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	@media (max-width: 700px) {
		.control-row {
			align-items: stretch;
			flex-direction: column;
		}

		.sort-select {
			width: fit-content;
		}
	}
</style>
