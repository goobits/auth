<script>
	const { data } = $props()

	let searchQuery = $state('')
	let selectedTags = $state([])
	let sortBy = $state('path')
	let collapsedCategories = $state({})
	let viewMode = $state('detailed')

	const availableTags = data.isDev
		? ['SSR', 'CSR', 'Dynamic', 'Auth', 'NoIndex', 'API', 'Layout']
		: ['SSR', 'CSR', 'Dynamic', 'Layout']

	const categoryOrder = [
		'Main Pages',
		'Journal Pages',
		'Journal Posts',
		'Admin Pages',
		'API Routes',
		'Utility Pages'
	]

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
	<meta name="description" content="Complete sitemap of MIKO.ART with all pages, journal posts, and API routes." />
</svelte:head>

<div class="sitemap">
	<header class="sitemap-header">
		<h1>Sitemap</h1>
		<p class="subtitle">All pages and routes on MIKO.ART</p>
		{#if data.isDev}
			<span class="dev-badge">DEV MODE</span>
		{/if}
	</header>

	<div class="stats">
		<div class="stat">
			<span class="value">{data.stats.total}</span>
			<span class="label">Total Routes</span>
		</div>
		<div class="stat">
			<span class="value">{data.stats.pages}</span>
			<span class="label">Pages</span>
		</div>
		{#if data.isDev}
			<div class="stat">
				<span class="value">{data.stats.api}</span>
				<span class="label">API Endpoints</span>
			</div>
		{/if}
		<div class="stat">
			<span class="value">{data.stats.dynamic}</span>
			<span class="label">Dynamic</span>
		</div>
		<div class="stat">
			<span class="value">{data.stats.ssr}</span>
			<span class="label">SSR</span>
		</div>
		{#if data.isDev}
			<div class="stat">
				<span class="value">{data.stats.protected}</span>
				<span class="label">Protected</span>
			</div>
		{/if}
	</div>

	<div class="controls">
		<div class="search">
			<input
				type="text"
				placeholder="Search routes..."
				bind:value={searchQuery}
			/>
		</div>

		<div class="filters">
			<div class="tag-filters">
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
				<select bind:value={sortBy}>
					<option value="path">Sort by Path</option>
					<option value="name">Sort by Name</option>
					<option value="modified">Sort by Modified</option>
				</select>

				<button
					class="view-toggle"
					class:active={viewMode === 'compact'}
					onclick={() => viewMode = viewMode === 'detailed' ? 'compact' : 'detailed'}
				>
					{viewMode === 'detailed' ? 'Compact' : 'Detailed'}
				</button>
			</div>
		</div>
	</div>

	{#if filteredCount === 0}
		<div class="no-results">
			<p>No routes match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedTags = [] }}>Clear Filters</button>
		</div>
	{:else}
		<div class="results-count">
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
							<span class="toggle-icon">{collapsedCategories[category] ? '+' : '−'}</span>
							{category}
							<span class="count">({filteredGrouped[category].length})</span>
						</h2>
					</button>

					{#if !collapsedCategories[category]}
						<ul>
							{#each filteredGrouped[category] as route}
								<li class="route" class:compact={viewMode === 'compact'}>
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
									{#if viewMode === 'detailed'}
										<div class="route-meta">
											<div class="tags">
												{#each getRouteTags(route) as tag}
													<span class="tag {tag.toLowerCase()}">{tag}</span>
												{/each}
											</div>
											<span class="modified">{formatDate(route.lastModified)}</span>
										</div>
									{/if}
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
		max-width: 900px;
		margin: 0 auto;
	}

	.sitemap-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 2.25rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--muted);
		font-size: 1rem;
	}

	.dev-badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 600;
		background: var(--form-error);
		color: white;
		border-radius: 3px;
		letter-spacing: 0.05em;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--panel-bg);
		border-radius: 8px;
		border: 1px solid var(--panel-border);
	}

	.stat {
		text-align: center;
		padding: 0.25rem 0.75rem;
	}

	.stat .value {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--link);
	}

	.stat .label {
		font-size: 0.75rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.controls {
		margin-bottom: 1.25rem;
	}

	.search input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.95rem;
		border: 1px solid var(--input-border);
		border-radius: 5px;
		background: var(--input-bg);
		color: var(--text);
		margin-bottom: 0.75rem;
	}

	.search input:focus {
		outline: none;
		border-color: var(--link);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: center;
	}

	.tag-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
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
		gap: 0.35rem;
	}

	.sort-view select {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--card-bg);
		color: var(--text);
		font-size: 0.85rem;
	}

	.view-toggle {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--card-bg);
		color: var(--text);
		cursor: pointer;
		font-size: 0.85rem;
	}

	.view-toggle:hover {
		border-color: var(--link);
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

	.results-count {
		font-size: 0.85rem;
		color: var(--muted);
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
		font-family: monospace;
		width: 1rem;
	}

	.count {
		font-weight: normal;
		color: var(--muted);
		font-size: 0.85rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0.35rem 0 0 0;
	}

	.route {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--panel-border);
	}

	.route:last-child {
		border-bottom: none;
	}

	.route.compact .route-meta {
		display: none;
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

	.method.get { background: var(--link); color: white; }
	.method.post { background: var(--button-bg); color: white; }
	.method.put { background: #f59e0b; color: white; }
	.method.delete { background: var(--form-error); color: white; }
	.method.patch { background: #14b8a6; color: white; }

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

	.tag.ssr { background: var(--link); color: white; }
	.tag.csr { background: #8b5cf6; color: white; }
	.tag.dynamic { background: #f59e0b; color: white; }
	.tag.auth { background: var(--form-error); color: white; }
	.tag.noindex { background: var(--muted); color: white; }
	.tag.api { background: var(--button-bg); color: white; }
	.tag.layout { background: var(--brand-primary); color: white; }

	.modified {
		font-size: 0.75rem;
		color: var(--muted);
		width: 5.5rem;
		text-align: right;
		font-family: monospace;
	}

	@media (max-width: 600px) {
		.stats {
			gap: 0.25rem;
		}

		.stat {
			flex: 1 1 calc(33% - 0.25rem);
			min-width: 70px;
			padding: 0.25rem 0.5rem;
		}

		.stat .value {
			font-size: 1.35rem;
		}

		.filters {
			flex-direction: column;
			align-items: stretch;
		}

		.sort-view {
			justify-content: space-between;
		}

		.route {
			flex-wrap: wrap;
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
