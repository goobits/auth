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

	const pastelCardThemes = [
		{ bg: '#ffdfe8', border: '#f5b9cb', ink: '#4f2332', muted: '#74404f' },
		{ bg: '#ffe8cc', border: '#f5c89f', ink: '#54341f', muted: '#7b5235' },
		{ bg: '#fff6bf', border: '#eadf92', ink: '#4d4421', muted: '#6f6536' },
		{ bg: '#daf6d8', border: '#b8e4b3', ink: '#22482b', muted: '#3e6b47' },
		{ bg: '#d7f3f2', border: '#addfdd', ink: '#1e4647', muted: '#3b6a6b' },
		{ bg: '#dde9ff', border: '#bdcff8', ink: '#27385a', muted: '#44577f' },
		{ bg: '#ece2ff', border: '#d2bdf8', ink: '#3d2b5f', muted: '#5e4784' },
		{ bg: '#ffe2f6', border: '#efbde0', ink: '#552949', muted: '#7a4a6f' }
	]

	function isExternalLab(href) {
		return href.endsWith('.html')
	}

	let searchQuery = $state('')
	let selectedScope = $state('all')
	let sortBy = $state('title')

	function getCardTheme(i) {
		return pastelCardThemes[i % pastelCardThemes.length]
	}

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
			<Search size={15} strokeWidth={2.2} style="color: var(--muted); flex-shrink: 0;" />
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
					<a href={lab.href} class="lab-card" style={`--card-bg:${getCardTheme(i).bg};--card-border:${getCardTheme(i).border};--card-ink:${getCardTheme(i).ink};--card-muted:${getCardTheme(i).muted};`}>
						<p class="card-top">
							<span class="kind">
								<FlaskConical size={13} strokeWidth={2.2} />
								{isExternalLab(lab.href) ? 'Demo' : 'Lab'}
							</span>
							{#if isExternalLab(lab.href)}
								<ExternalLink size={14} strokeWidth={2.2} style="color: var(--card-muted);" />
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
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.9rem;
	}

	.lab-card {
		--card-surface-1: color-mix(in srgb, var(--card-bg) 88%, white);
		--card-surface-2: color-mix(in srgb, var(--card-bg) 76%, #f7f3ff);
		--card-glow: color-mix(in srgb, var(--card-border) 54%, transparent);
		display: grid;
		grid-template-rows: auto auto auto 1fr auto auto;
		gap: 0.52rem;
		padding: 0.9rem;
		aspect-ratio: 1 / 1;
		text-decoration: none;
		color: var(--card-ink);
		border-radius: 10px;
		border: 1px solid var(--card-border);
		background:
			radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, var(--card-glow) 68%, transparent) 0%, transparent 55%),
			radial-gradient(90% 110% at 100% 100%, color-mix(in srgb, var(--card-glow) 52%, transparent) 0%, transparent 60%),
			linear-gradient(145deg, var(--card-surface-1) 0%, var(--card-surface-2) 100%);
		box-shadow: 0 8px 18px color-mix(in srgb, var(--card-border) 34%, transparent);
		transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
	}

	.lab-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--card-border) 82%, var(--card-ink));
		box-shadow: 0 14px 26px color-mix(in srgb, var(--card-border) 48%, transparent);
	}

	:global(html[data-theme='dark']) .lab-card,
	:global(html.theme-system-dark) .lab-card {
		--card-surface-1: color-mix(in srgb, var(--card-bg) 32%, #181b26);
		--card-surface-2: color-mix(in srgb, var(--card-bg) 22%, #10131c);
		--card-glow: color-mix(in srgb, var(--card-border) 36%, transparent);
		--card-ink: color-mix(in srgb, white 86%, var(--card-bg));
		--card-muted: color-mix(in srgb, white 66%, var(--card-bg));
		border-color: color-mix(in srgb, var(--card-border) 52%, #232837);
		box-shadow: 0 10px 20px rgba(10, 12, 18, 0.42);
	}

	:global(html[data-theme='dark']) .lab-card:hover,
	:global(html.theme-system-dark) .lab-card:hover {
		border-color: color-mix(in srgb, var(--card-border) 64%, white 20%);
		box-shadow: 0 16px 30px rgba(7, 9, 14, 0.58);
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
		color: var(--card-muted);
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
		color: var(--card-muted);
		font-family: var(--font-serif);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.path {
		margin: auto 0 0;
		font-family: monospace;
		font-size: 0.72rem;
		color: var(--card-muted);
		opacity: 0.95;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.open {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.78rem;
		font-weight: 600;
		font-family: var(--font-sans);
		color: var(--card-ink);
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
