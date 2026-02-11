<script>
	import { ArrowUpDown, ExternalLink, Filter, Folder, Search } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const labs = [
		{ href: '/labs/color-galaxy', title: 'Color Galaxy' },
		{ href: '/labs/js1k/BreathingGalaxies.html', title: 'JS1k - Breathing Galaxies' },
		{ href: '/labs/js1k/Daltonize.html', title: 'JS1k - Daltonize' },
		{ href: '/labs/js1k/MicroSketchpad.html', title: 'JS1k - Micro Sketchpad' },
		{ href: '/labs/js1k/SpectrumDJ.html', title: 'JS1k - Spectrum DJ' },
		{ href: '/labs/midi-js', title: 'MIDI.js' },
		{ href: '/labs/sketch-js', title: 'Sketch.js' },
		{ href: '/labs/sketchpad-1.0', title: 'Sketchpad v1.0' },
		{ href: '/labs/thumbnailer', title: 'Thumbnailer' },
		{ href: '/labs/zen-bg', title: 'Zen BG' }
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
			return lab.title.toLowerCase().includes(query) || lab.href.toLowerCase().includes(query)
		})

		return filtered.sort((a, b) => {
			if (sortBy === 'path') return a.href.localeCompare(b.href)
			return a.title.localeCompare(b.title)
		})
	})

	const internalLabs = $derived(filteredLabs.filter((lab) => !isExternalLab(lab.href)))
	const externalLabs = $derived(filteredLabs.filter((lab) => isExternalLab(lab.href)))
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
	<div class="controls">
		<div class="search-field">
			<Search class="search-icon" size={15} strokeWidth={2.2} />
			<input
				type="text"
				placeholder="Search labs..."
				bind:value={searchQuery}
			/>
		</div>

		<div class="filters">
			<div class="tag-filters">
				<span class="filter-label">
					<Filter size={13} strokeWidth={2.2} />
					<span>Scope</span>
				</span>
				<button class="tag-filter" class:active={selectedScope === 'all'} onclick={() => (selectedScope = 'all')}>All</button>
				<button class="tag-filter" class:active={selectedScope === 'internal'} onclick={() => (selectedScope = 'internal')}>Internal</button>
				<button class="tag-filter" class:active={selectedScope === 'external'} onclick={() => (selectedScope = 'external')}>External</button>
			</div>

			<div class="sort-view">
				<div class="sort-toggle" role="tablist" aria-label="Sort labs">
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'title'}
						aria-selected={sortBy === 'title'}
						onclick={() => (sortBy = 'title')}
					>
						<ArrowUpDown size={13} strokeWidth={2.2} />
						<span>Name</span>
					</button>
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'path'}
						aria-selected={sortBy === 'path'}
						onclick={() => (sortBy = 'path')}
					>
						<Folder size={13} strokeWidth={2.2} />
						<span>Path</span>
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if filteredLabs.length === 0}
		<div class="no-results">
			<p>No labs match your filters.</p>
			<button onclick={() => {
				searchQuery = ''
				selectedScope = 'all'
			}}>Clear Filters</button>
		</div>
	{:else}
		<div class="results-count">Showing {filteredLabs.length} of {labs.length} labs</div>

		{#if internalLabs.length > 0}
			<section class="category">
				<div class="category-header">
					<h2>Internal Labs <span class="count">({internalLabs.length})</span></h2>
				</div>
				<ul>
					{#each internalLabs as lab}
						<li class="route">
							<div class="route-main">
								<a href={lab.href} class="route-link">
									<Folder class="folder-icon" size={16} strokeWidth={2.1} />
									<span class="lab-title">{lab.title}</span>
								</a>
							</div>
							<div class="route-meta">
								<span class="route-path">{lab.href}</span>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if externalLabs.length > 0}
			<section class="category">
				<div class="category-header">
					<h2>External Demos <span class="count">({externalLabs.length})</span></h2>
				</div>
				<ul>
					{#each externalLabs as lab}
						<li class="route">
							<div class="route-main">
								<a href={lab.href} class="route-link">
									<Folder class="folder-icon" size={16} strokeWidth={2.1} />
									<span class="lab-title">{lab.title}</span>
									<ExternalLink class="external-icon" size={14} strokeWidth={2.2} />
								</a>
							</div>
							<div class="route-meta">
								<span class="route-path">{lab.href}</span>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.labs {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.controls {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1.25rem;
	}

	.search-field {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0 0.6rem;
		border: 1px solid var(--input-border);
		border-radius: 5px;
		background: var(--input-bg);
	}

	.search-icon {
		color: var(--muted);
		flex-shrink: 0;
	}

	input {
		width: 100%;
		padding: 0.5rem 0;
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

	.filters {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.6rem;
		align-items: center;
	}

	.tag-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.filter-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--muted);
		margin-right: 0.35rem;
	}

	.tag-filter {
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--card-bg);
		color: var(--text);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tag-filter:hover {
		border-color: var(--link);
	}

	.tag-filter.active {
		background: var(--brand-primary);
		border-color: var(--brand-primary);
		color: white;
	}

	.sort-view {
		display: flex;
		justify-self: end;
	}

	.sort-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.2rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--card-bg);
	}

	.sort-toggle button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		padding: 0.35rem 0.68rem;
		line-height: 1;
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.sort-toggle button:hover {
		color: var(--text);
	}

	.sort-toggle button.active {
		background: var(--brand-primary);
		color: white;
	}

	.results-count {
		font-size: 0.85rem;
		color: var(--muted);
		margin-bottom: 0.75rem;
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

	.category {
		margin-bottom: 1rem;
	}

	.category-header {
		width: 100%;
		display: block;
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}

	.category-header h2 {
		font-size: 1.1rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.count {
		font-weight: normal;
		color: var(--muted);
		font-size: 0.85rem;
	}

	ul {
		list-style: none;
		padding: 0 0 0 1.35rem;
		margin: 0.45rem 0 0 0;
		display: grid;
		gap: 0.2rem;
	}

	.route {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--panel-border);
	}

	.route:last-child {
		border-bottom: none;
	}

	.route-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.route-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: monospace;
		font-size: 0.9rem;
		text-decoration: none;
		color: var(--text);
		min-width: 0;
	}

	.route-link:hover {
		color: var(--link-hover);
	}

	.folder-icon {
		color: var(--lab-icon);
		flex-shrink: 0;
	}

	.external-icon {
		color: var(--muted);
		opacity: 0.75;
		flex-shrink: 0;
	}

	.lab-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.route-meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.route-path {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--muted);
	}

	@media (max-width: 600px) {
		.filters {
			grid-template-columns: 1fr;
			align-items: stretch;
		}

		.sort-view {
			justify-self: start;
		}

		.route {
			grid-template-columns: minmax(0, 1fr);
		}

		.route-meta {
			justify-content: flex-start;
		}

		.route-path {
			font-size: 0.7rem;
		}
	}
</style>
