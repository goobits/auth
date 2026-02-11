<script>
	import {
		BookOpen,
		ChevronDown,
		ChevronRight,
		Clock3,
		Cpu,
		Filter,
		FileText,
		House,
		Route,
		Search,
		Shield,
		Type,
		Wrench
	} from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const { data } = $props()

	let searchQuery = $state('')
	let selectedTags = $state([])
	let sortBy = $state('path')
	let collapsedCategories = $state({})

	const availableTags = $derived(data.showDevDiagnostics
		? ['SSR', 'CSR', 'Dynamic', 'Auth', 'NoIndex', 'API', 'Layout']
		: ['SSR', 'CSR', 'Dynamic', 'Layout'])

	const categoryOrder = [
		'Main Pages',
		'Journal Pages',
		'Journal Posts',
		'Admin Pages',
		'API Routes',
		'Utility Pages'
	]
	const categoryIcons = {
		'Main Pages': House,
		'Journal Pages': BookOpen,
		'Journal Posts': FileText,
		'Admin Pages': Shield,
		'API Routes': Cpu,
		'Utility Pages': Wrench
	}

	function getRouteTags(route) {
		const tags = []
		if (route.type === 'api') tags.push('API')
		if (route.hasServerLoad) tags.push('SSR')
		if (route.hasClientLoad) tags.push('CSR')
		if (route.isDynamic) tags.push('Dynamic')
		if (route.hasAuth) tags.push('Auth')
		if (route.isNoIndex) tags.push('NoIndex')
		if (route.hasLayout) tags.push('Layout')
		return tags
	}

	function matchesFilters(route) {
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			const matchesPath = route.path.toLowerCase().includes(query)
			const matchesName = route.name.toLowerCase().includes(query)
			if (!matchesPath && !matchesName) return false
		}

		// Tag filter
		if (selectedTags.length > 0) {
			const routeTags = getRouteTags(route)
			const hasAllTags = selectedTags.every(tag => routeTags.includes(tag))
			if (!hasAllTags) return false
		}

		return true
	}

	function sortRoutes(routes) {
		return [...routes].sort((a, b) => {
			switch (sortBy) {
				case 'name':
					return a.name.localeCompare(b.name)
				case 'modified':
					return new Date(b.lastModified) - new Date(a.lastModified)
				case 'path':
				default:
					return a.path.localeCompare(b.path)
			}
		})
	}

	function toggleCategory(category) {
		collapsedCategories[category] = !collapsedCategories[category]
	}

	function toggleTag(tag) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter(t => t !== tag)
		} else {
			selectedTags = [...selectedTags, tag]
		}
	}

	function formatDate(isoString) {
		const d = new Date(isoString)
		const mm = String(d.getMonth() + 1).padStart(2, '0')
		const dd = String(d.getDate()).padStart(2, '0')
		const yyyy = d.getFullYear()
		return `${mm}-${dd}-${yyyy}`
	}

	function getFilteredGrouped() {
		const result = {}
		for (const [category, routes] of Object.entries(data.grouped)) {
			const filtered = sortRoutes(routes.filter(matchesFilters))
			if (filtered.length > 0) {
				result[category] = filtered
			}
		}
		return result
	}

	const filteredGrouped = $derived(getFilteredGrouped())
	const filteredCount = $derived(
		Object.values(filteredGrouped).reduce((sum, routes) => sum + routes.length, 0)
	)
</script>

<svelte:head>
	<title>Sitemap - MIKO.ART</title>
	<meta name="description" content="Human-readable sitemap for MIKO.ART with public pages and journal posts." />
</svelte:head>

<HeroBanner
	title="Sitemap"
	subtitle="A friendly map of everything on this site."
	icon="/media/emoji-sitemap.png"
/>

<div class="sitemap">
	<header class="sitemap-header">
		{#if data.showDevDiagnostics}
			<span class="dev-badge">DEV MODE</span>
		{/if}
	</header>

	<div class="controls">
		<div class="search">
			<div class="ui-search-field">
				<Search class="ui-search-icon" size={15} strokeWidth={2.2} />
				<input
					class="ui-search-input"
					type="text"
					placeholder="Search routes..."
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<div class="filters">
			<div class="tag-filters">
				<span class="filter-label">
					<Filter size={13} strokeWidth={2.2} />
					<span>Filters</span>
				</span>
				{#each availableTags as tag}
					<button
						class="tag-filter"
						class:active={selectedTags.includes(tag)}
						onclick={() => toggleTag(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>

			<div class="sort-view">
				<div class="sort-toggle" role="tablist" aria-label="Sort routes">
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'path'}
						aria-selected={sortBy === 'path'}
						onclick={() => sortBy = 'path'}
					>
						<Route size={13} strokeWidth={2.2} />
						<span>Path</span>
					</button>
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'name'}
						aria-selected={sortBy === 'name'}
						onclick={() => sortBy = 'name'}
					>
						<Type size={13} strokeWidth={2.2} />
						<span>Name</span>
					</button>
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'modified'}
						aria-selected={sortBy === 'modified'}
						onclick={() => sortBy = 'modified'}
					>
						<Clock3 size={13} strokeWidth={2.2} />
						<span>Recent</span>
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if filteredCount === 0}
		<div class="ui-no-results">
			<p>No routes match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedTags = [] }}>Clear Filters</button>
		</div>
	{:else}
		<div class="ui-results-count results-count">
			Showing {filteredCount} of {data.stats.total} routes
		</div>

		{#each categoryOrder as category}
			{#if filteredGrouped[category]}
				<section class="category">
					<button
						class="category-header"
						onclick={() => toggleCategory(category)}
					>
						<h2>
							<svelte:component this={categoryIcons[category] || FileText} class="category-icon" size={14} strokeWidth={2.2} />
							{#if collapsedCategories[category]}
								<ChevronRight class="toggle-icon" size={14} strokeWidth={2.25} />
							{:else}
								<ChevronDown class="toggle-icon" size={14} strokeWidth={2.25} />
							{/if}
							{category}
							<span class="count">({filteredGrouped[category].length})</span>
						</h2>
					</button>

					{#if !collapsedCategories[category]}
						<ul>
							{#each filteredGrouped[category] as route}
								<li class="route">
									<div class="route-main">
										{#if route.type === 'api'}
											<span class="route-path">{route.path}</span>
											{#if route.httpMethods?.length > 0}
												<span class="methods">
													{#each route.httpMethods as method}
														<span class="method {method.toLowerCase()}">{method}</span>
													{/each}
												</span>
											{/if}
										{:else}
											<a href={route.path} class="route-link">{route.path}</a>
										{/if}
									</div>
									<div class="route-meta">
										<div class="tags">
											{#each getRouteTags(route) as tag}
												<span class="tag {tag.toLowerCase()}">{tag}</span>
											{/each}
										</div>
										<span class="modified">{formatDate(route.lastModified)}</span>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{/each}
	{/if}

</div>

<style>
	.sitemap {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.sitemap-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.dev-badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 600;
		background: var(--form-error);
		color: var(--color-white);
		border-radius: 3px;
		letter-spacing: 0.05em;
	}

	.controls {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1.25rem;
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
		padding-right: 0.1rem;
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
		color: var(--color-white);
	}

	.sort-view {
		display: flex;
		gap: 0.35rem;
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
		color: var(--color-white);
	}

	.results-count {
		margin-bottom: 0.75rem;
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
		cursor: pointer;
		text-align: left;
	}

	.category-header:hover {
		border-color: var(--link);
	}

	.category-header h2 {
		font-size: 1.1rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.toggle-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--muted);
	}

	.category-icon {
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
		color: var(--muted);
	}

	.count {
		font-weight: normal;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.category ul {
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
		flex-wrap: wrap;
		min-width: 0;
	}

	.route-link {
		font-family: monospace;
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--text);
	}

	.route-link:hover {
		color: var(--link-hover);
	}

	.route-path {
		font-family: monospace;
		font-size: 0.85rem;
		color: var(--text);
	}

	.methods {
		display: flex;
		gap: 0.2rem;
	}

	.method {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.method.get { background: var(--link); color: var(--color-white); }
	.method.post { background: var(--button-bg); color: var(--color-white); }
	.method.put { background: var(--color-warning); color: var(--color-white); }
	.method.delete { background: var(--form-error); color: var(--color-white); }
	.method.patch { background: var(--color-teal); color: var(--color-white); }

	.route-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.tags {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	.tag {
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		background: var(--tag-bg);
		color: var(--text);
	}

	.tag.ssr { background: var(--link); color: var(--color-white); }
	.tag.csr { background: var(--color-violet); color: var(--color-white); }
	.tag.dynamic { background: var(--color-warning); color: var(--color-white); }
	.tag.auth { background: var(--form-error); color: var(--color-white); }
	.tag.noindex { background: var(--muted); color: var(--color-white); }
	.tag.api { background: var(--button-bg); color: var(--color-white); }
	.tag.layout { background: var(--color-cyan); color: var(--color-white); }

	.modified {
		font-size: 0.75rem;
		color: var(--muted);
		width: 5.5rem;
		text-align: right;
		font-family: monospace;
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
			width: 100%;
			justify-content: flex-end;
		}

		.modified {
			display: none;
		}
	}
</style>
