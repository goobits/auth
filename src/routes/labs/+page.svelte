<script>
	import { ArrowUpDown, ExternalLink, FlaskConical, Search, Sparkles } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const labs = [
		{ href: '/labs/color-galaxy/', title: 'Color Galaxy', vibe: 'Generative color playground' },
		{ href: '/labs/js1k/BreathingGalaxies.html', title: 'JS1k - Breathing Galaxies', vibe: 'Tiny code, cosmic motion' },
		{ href: '/labs/js1k/Daltonize.html', title: 'JS1k - Daltonize', vibe: 'Color accessibility experiment' },
		{ href: '/labs/js1k/MicroSketchpad.html', title: 'JS1k - Micro Sketchpad', vibe: 'Pocket-sized drawing toy' },
		{ href: '/labs/js1k/SpectrumDJ.html', title: 'JS1k - Spectrum DJ', vibe: 'Music + visuals mashup' },
		{ href: '/labs/midi-js/', title: 'MIDI.js', vibe: 'Browser MIDI tooling' },
		{ href: '/labs/sketch-js/', title: 'Sketch.js', vibe: 'Creative coding toolkit' },
		{ href: '/labs/sketchpad-1.0/', title: 'Sketchpad v1.0', vibe: 'Early product prototype' },
		{ href: '/labs/thumbnailer/', title: 'Thumbnailer', vibe: 'Image utility experiment' },
		{ href: '/labs/zen-bg/', title: 'Zen BG', vibe: 'Ambient background generator' }
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

<div class="labs labs-page">
	<div class="tools labs-page__tools" aria-label="Labs filters">
		<label class="ui-search-field labs-page__search" aria-label="Search labs">
			<Search size={15} strokeWidth={2.2} style="color: var(--muted); flex-shrink: 0;" />
			<input class="ui-search-input" type="text" placeholder="Search experiments..." bind:value={searchQuery} />
		</label>

		<div class="control-row labs-page__controls">
			<div class="chips labs-page__chips" role="tablist" aria-label="Scope filter">
				<button type="button" class:active={selectedScope === 'all'} onclick={() => (selectedScope = 'all')}>All</button>
				<button type="button" class:active={selectedScope === 'internal'} onclick={() => (selectedScope = 'internal')}>Internal</button>
				<button type="button" class:active={selectedScope === 'external'} onclick={() => (selectedScope = 'external')}>External</button>
			</div>

			<label class="sort-select labs-page__sort">
				<ArrowUpDown size={13} strokeWidth={2.2} />
				<select bind:value={sortBy} aria-label="Sort labs">
					<option value="title">Name</option>
					<option value="path">Path</option>
				</select>
			</label>
		</div>
	</div>

	{#if filteredLabs.length === 0}
		<div class="ui-no-results labs-page__no-results">
			<p>No experiments match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedScope = 'all'; sortBy = 'title' }}>Clear Filters</button>
		</div>
	{:else}
		<p class="ui-results-count labs-page__results">{filteredLabs.length} experiments</p>

		<ul class="grid labs-page__grid">
			{#each filteredLabs as lab, i}
				<li>
					<a href={lab.href} class="lab-card labs-page__card" style={`--card-bg:${getCardTheme(i).bg};--card-border:${getCardTheme(i).border};--card-ink:${getCardTheme(i).ink};--card-muted:${getCardTheme(i).muted};`}>
						<div class="lab-visual labs-page__visual" aria-hidden="true"></div>
						<p class="card-top labs-page__card-top">
							<span class="kind labs-page__kind">
								<FlaskConical size={13} strokeWidth={2.2} />
								{isExternalLab(lab.href) ? 'Demo' : 'Lab'}
							</span>
							{#if isExternalLab(lab.href)}
								<ExternalLink size={14} strokeWidth={2.2} style="color: var(--card-muted);" />
							{/if}
						</p>
						<h2><span>{lab.title}</span></h2>
						<p class="vibe labs-page__vibe">{lab.vibe}</p>
						<p class="path labs-page__path">{lab.href}</p>
						<p class="open labs-page__open">
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
		grid-template-rows: 1fr auto auto auto;
		gap: 0.5rem;
		padding: 0.8rem 0.8rem 0.85rem;
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
		position: relative;
		overflow: hidden;
	}

	.lab-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--card-border) 82%, var(--card-ink));
		box-shadow: 0 14px 26px color-mix(in srgb, var(--card-border) 48%, transparent);
	}

	:global(html[data-theme='dark']) .lab-card,
	:global(html.theme-system-dark) .lab-card {
		--card-surface-1: color-mix(in srgb, var(--card-bg) 62%, #2b1750);
		--card-surface-2: color-mix(in srgb, var(--card-bg) 52%, #1a1037);
		--card-glow: color-mix(in srgb, var(--card-border) 68%, #6e46c7);
		--card-ink: color-mix(in srgb, white 92%, var(--card-bg));
		--card-muted: color-mix(in srgb, white 74%, var(--card-bg));
		border-color: color-mix(in srgb, var(--card-border) 80%, #5f3eb3);
		box-shadow: 0 12px 24px rgba(7, 9, 14, 0.5);
	}

	:global(html[data-theme='dark']) .lab-card:hover,
	:global(html.theme-system-dark) .lab-card:hover {
		border-color: color-mix(in srgb, var(--card-border) 86%, #9b7dff);
		box-shadow: 0 18px 34px rgba(6, 8, 12, 0.64);
	}

	.lab-visual {
		grid-row: 1 / 2;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--card-border) 70%, white);
		background:
			radial-gradient(85% 90% at 20% 16%, color-mix(in srgb, var(--card-bg) 75%, white) 0%, transparent 65%),
			radial-gradient(70% 80% at 84% 86%, color-mix(in srgb, var(--card-border) 30%, transparent) 0%, transparent 70%),
			linear-gradient(140deg, color-mix(in srgb, var(--card-bg) 72%, white), color-mix(in srgb, var(--card-bg) 66%, #ecddff));
		box-shadow: inset 0 1px 0 color-mix(in srgb, white 50%, transparent);
	}

	.card-top {
		grid-row: 2 / 3;
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
		position: absolute;
		top: 0.72rem;
		left: 0.72rem;
		margin: 0;
		font-family: var(--font-sans);
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.01em;
		pointer-events: none;
	}

	.lab-card h2 span {
		display: inline-block;
		padding: 0.46rem 0.62rem 0.44rem;
		border-radius: 7px;
		color: #fff;
		background: color-mix(in srgb, #000 84%, var(--card-ink));
		border: 1px solid color-mix(in srgb, #000 74%, var(--card-border));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
		max-width: 11.2rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vibe {
		grid-row: 3 / 4;
		margin: 0;
		font-size: 0.9rem;
		color: var(--card-muted);
		font-family: var(--font-serif);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.path {
		grid-row: 4 / 5;
		margin: 0;
		font-family: monospace;
		font-size: 0.72rem;
		color: var(--card-muted);
		opacity: 0.95;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.open {
		grid-row: 4 / 5;
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.78rem;
		font-weight: 600;
		font-family: var(--font-sans);
		color: var(--card-ink);
		justify-self: end;
	}

	:global(html[data-theme='dark']) .lab-card h2 span,
	:global(html.theme-system-dark) .lab-card h2 span {
		background: color-mix(in srgb, #090b11 72%, var(--card-ink));
		border-color: color-mix(in srgb, #04050a 75%, var(--card-border));
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.34);
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
