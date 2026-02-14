<script>
	import {
		BookOpen,
		ChevronDown,
		ChevronRight,
		Cpu,
		Filter,
		FileText,
		House,
		Shield,
		Wrench
	} from '@lucide/svelte'
	import FilterChipGroup from '$lib/ui/FilterChipGroup.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PageContainer from '$lib/ui/PageContainer.svelte'
	import ResultsEmpty from '$lib/ui/ResultsEmpty.svelte'
	import SearchToolbar from '$lib/ui/SearchToolbar.svelte'
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte'

	const { data } = $props()

	let searchQuery = $state('')
	let selectedTags = $state([])
	let sortBy = $state('path')
	let collapsedCategories = $state({})
	const sortOptions = [
		{ value: 'path', label: 'Path' },
		{ value: 'name', label: 'Name' },
		{ value: 'modified', label: 'Recent' }
	]

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

<Hero
	title="Sitemap"
	subtitle="A friendly map of everything on this site."
	icon="/media/emoji-sitemap.png"
/>

<PageContainer className="sitemap-page">
	<header class="sitemap-page__header">
		{#if data.showDevDiagnostics}
			<span class="sitemap-page__dev-badge">DEV MODE</span>
		{/if}
	</header>

	<div class="sitemap-page__controls">
		<SearchToolbar bind:query={searchQuery} placeholder="Search routes..." ariaLabel="Search routes">
			<div class="sitemap-page__filters">
				<div class="sitemap-page__tag-filters">
					<span class="sitemap-page__filter-label">
						<Filter size={13} strokeWidth={2.2} />
						<span>Filters</span>
					</span>
					<FilterChipGroup
						className="sitemap-page__tag-filter-group"
						items={availableTags}
						bind:selected={selectedTags}
						multiple={true}
						ariaLabel="Sitemap filters"
					/>
				</div>

				<div class="sitemap-page__sort-view">
					<SegmentedControl
						className="sitemap-page__sort-toggle"
						options={sortOptions}
						bind:value={sortBy}
						ariaLabel="Sort routes"
					/>
				</div>
			</div>
		</SearchToolbar>
	</div>

	{#if filteredCount === 0}
		<ResultsEmpty
			className="sitemap-page__no-results"
			message="No routes match your filters."
			onAction={() => { searchQuery = ''; selectedTags = [] }}
		/>
	{:else}
		<div class="sitemap-page__results-count">
			Showing {filteredCount} of {data.stats.total} routes
		</div>

		{#each categoryOrder as category}
		{#if filteredGrouped[category]}
			{@const CategoryIcon = categoryIcons[category] || FileText}
			<section class="sitemap-page__category">
				<button
					class="sitemap-page__category-header"
					onclick={() => toggleCategory(category)}
				>
					<h2>
						<CategoryIcon class="sitemap-page__category-icon" size={14} strokeWidth={2.2} />
							{#if collapsedCategories[category]}
								<ChevronRight class="sitemap-page__toggle-icon" size={14} strokeWidth={2.25} />
							{:else}
								<ChevronDown class="sitemap-page__toggle-icon" size={14} strokeWidth={2.25} />
							{/if}
							{category}
							<span class="sitemap-page__count">({filteredGrouped[category].length})</span>
						</h2>
					</button>

					{#if !collapsedCategories[category]}
						<ul>
							{#each filteredGrouped[category] as route}
								<li class="sitemap-page__route">
									<div class="sitemap-page__route-main">
										{#if route.type === 'api'}
											<span class="sitemap-page__route-path">{route.path}</span>
											{#if route.httpMethods?.length > 0}
												<span class="sitemap-page__methods">
													{#each route.httpMethods as method}
														<span class="sitemap-page__method {method.toLowerCase()}">{method}</span>
													{/each}
												</span>
											{/if}
										{:else}
											{#if route.isDynamic}
												<span class="sitemap-page__route-path">{route.path}</span>
											{:else}
												<a href={route.path} class="sitemap-page__route-link">{route.path}</a>
											{/if}
										{/if}
									</div>
									<div class="sitemap-page__route-meta">
										<div class="sitemap-page__tags">
											{#each getRouteTags(route) as tag}
												<span class="sitemap-page__tag {tag.toLowerCase()}">{tag}</span>
											{/each}
										</div>
										<span class="sitemap-page__modified">{formatDate(route.lastModified)}</span>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{/each}
	{/if}

</PageContainer>

<style>
	.sitemap-page__header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.sitemap-page__dev-badge {
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

	.sitemap-page__controls {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1.25rem;
	}

	.sitemap-page__filters {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.6rem;
		align-items: center;
	}

	.sitemap-page__tag-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.sitemap-page__tag-filter-group {
		display: inline-flex;
	}

	.sitemap-page__filter-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--muted);
		margin-right: 0.35rem;
		padding-right: 0.1rem;
	}

	.sitemap-page__sort-view {
		display: flex;
		gap: 0.35rem;
		justify-self: end;
	}

	.sitemap-page__sort-toggle {
		flex-shrink: 0;
	}

	.sitemap-page__results-count {
		margin-bottom: 0.75rem;
	}

	.sitemap-page__category {
		margin-bottom: 1rem;
	}

	.sitemap-page__category-header {
		width: 100%;
		display: block;
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		text-align: left;
	}

	.sitemap-page__category-header:hover {
		border-color: var(--link);
	}

	.sitemap-page__category-header h2 {
		font-size: 1.1rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.sitemap-page__toggle-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--muted);
	}

	.sitemap-page__category-icon {
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
		color: var(--muted);
	}

	.sitemap-page__count {
		font-weight: normal;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.sitemap-page__category ul {
		list-style: none;
		padding: 0 0 0 1.35rem;
		margin: 0.45rem 0 0 0;
		display: grid;
		gap: 0.2rem;
	}

	.sitemap-page__route {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--panel-border);
	}

	.sitemap-page__route:last-child {
		border-bottom: none;
	}

	.sitemap-page__route-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.sitemap-page__route-link {
		font-family: monospace;
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--text);
	}

	.sitemap-page__route-link:hover {
		color: var(--link-hover);
	}

	.sitemap-page__route-path {
		font-family: monospace;
		font-size: 0.85rem;
		color: var(--text);
	}

	.sitemap-page__methods {
		display: flex;
		gap: 0.2rem;
	}

	.sitemap-page__method {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.sitemap-page__method.get { background: var(--link); color: var(--color-white); }
	.sitemap-page__method.post { background: var(--button-bg); color: var(--color-white); }
	.sitemap-page__method.put { background: var(--color-warning); color: var(--color-white); }
	.sitemap-page__method.delete { background: var(--form-error); color: var(--color-white); }
	.sitemap-page__method.patch { background: var(--color-teal); color: var(--color-white); }

	.sitemap-page__route-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.sitemap-page__tags {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	.sitemap-page__tag {
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		background: var(--tag-bg);
		color: var(--text);
	}

	.sitemap-page__tag.ssr { background: var(--link); color: var(--color-white); }
	.sitemap-page__tag.csr { background: var(--color-violet); color: var(--color-white); }
	.sitemap-page__tag.dynamic { background: var(--color-warning); color: var(--color-white); }
	.sitemap-page__tag.auth { background: var(--form-error); color: var(--color-white); }
	.sitemap-page__tag.noindex { background: var(--muted); color: var(--color-white); }
	.sitemap-page__tag.api { background: var(--button-bg); color: var(--color-white); }
	.sitemap-page__tag.layout { background: var(--color-cyan); color: var(--color-white); }

	.sitemap-page__modified {
		font-size: 0.75rem;
		color: var(--muted);
		width: 5.5rem;
		text-align: right;
		font-family: monospace;
	}

	@media (max-width: 600px) {
		.sitemap-page__filters {
			grid-template-columns: 1fr;
			align-items: stretch;
		}

		.sitemap-page__sort-view {
			justify-self: start;
		}

		.sitemap-page__route {
			grid-template-columns: minmax(0, 1fr);
		}

		.sitemap-page__route-meta {
			width: 100%;
			justify-content: flex-end;
		}

		.sitemap-page__modified {
			display: none;
		}
	}
</style>
