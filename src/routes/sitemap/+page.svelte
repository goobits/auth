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
	import FilterableCollection from '$lib/ui/FilterableCollection.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PageContainer from '$lib/ui/PageContainer.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import SearchToolbar from '$lib/ui/SearchToolbar.svelte'
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte'
	import SitemapCategory from '$lib/ui/SitemapCategory.svelte'
	import { formatDateMmDdYyyy } from '$lib/utils/date'
	import {
		getFilteredSitemapCount,
		getFilteredSitemapGroups,
		getRouteTags,
		getSitemapAvailableTags
	} from '$lib/viewmodels/sitemap'

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

	const availableTags = $derived(getSitemapAvailableTags(data.showDevDiagnostics))

	const categoryOrder = [
		'Main Pages',
		'Journal Pages',
		'Journal Posts',
		'Admin Pages',
		'API Routes',
		'Utility Pages'
	]
	const accentColors = [
		'#ec4899',
		'#f59e0b',
		'#eab308',
		'#22c55e',
		'#14b8a6',
		'#3b82f6',
		'#8b5cf6',
		'#f43f5e',
		'#f97316'
	]

	function hashString(input) {
		let h = 0
		for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
		return Math.abs(h)
	}

	function getAccentColor(category) {
		const idx = hashString(category || '') % accentColors.length
		return accentColors[idx]
	}
	const categoryIcons = {
		'Main Pages': House,
		'Journal Pages': BookOpen,
		'Journal Posts': FileText,
		'Admin Pages': Shield,
		'API Routes': Cpu,
		'Utility Pages': Wrench
	}

	function toggleCategory(category) {
		collapsedCategories[category] = !collapsedCategories[category]
	}

	const filteredGrouped = $derived(getFilteredSitemapGroups(data.grouped, searchQuery, selectedTags, sortBy))
	const filteredCount = $derived(getFilteredSitemapCount(filteredGrouped))
</script>

<svelte:head>
	<title>Sitemap - MIKO.ART</title>
	<meta name="description" content="Human-readable sitemap for MIKO.ART with public pages and journal posts." />
</svelte:head>

<PageShell className="sitemap-page">
	<div class="sitemap-page__inner">
		<Hero
			eyebrow="Sitemap"
			title="Sitemap 🧭"
			subtitle="A friendly map of everything on this site."
		/>

		<PageContainer className="sitemap-page__content">
			<header class="sitemap-page__header">
				{#if data.showDevDiagnostics}
					<span class="sitemap-page__dev-badge">DEV MODE</span>
				{/if}
			</header>

			<FilterableCollection
				count={filteredCount}
				countLabel={`of ${data.stats.total} routes`}
				emptyMessage="No routes match your filters."
				onClear={() => { searchQuery = ''; selectedTags = [] }}
			>
				{#snippet toolbar()}
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
				{/snippet}

				{#each categoryOrder as category}
					{#if filteredGrouped[category]}
						{@const CategoryIcon = categoryIcons[category] || FileText}
						<SitemapCategory
							category={category}
							count={filteredGrouped[category].length}
							collapsed={Boolean(collapsedCategories[category])}
							onToggle={() => toggleCategory(category)}
							accent={getAccentColor(category)}
							routes={filteredGrouped[category]}
							getRouteTags={getRouteTags}
							formatDate={formatDateMmDdYyyy}
							icon={CategoryIcon}
							ChevronDownIcon={ChevronDown}
							ChevronRightIcon={ChevronRight}
						/>
					{/if}
				{/each}
			</FilterableCollection>
		</PageContainer>
	</div>
</PageShell>

<style>
	.sitemap-page__inner {
		--sitemap-dev-badge-padding: 0.2rem 0.6rem;
		--sitemap-dev-badge-size: 0.7rem;
		--sitemap-dev-badge-radius: 3px;
		--sitemap-controls-gap: 0.7rem;
		--sitemap-filters-gap: 0.6rem;
		--sitemap-tag-gap: 0.35rem;
		--sitemap-filter-label-gap: 0.3rem;
		--sitemap-filter-label-size: 0.78rem;
		--sitemap-sort-gap: 0.35rem;
	}

	.sitemap-page__header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.sitemap-page__dev-badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: var(--sitemap-dev-badge-padding);
		font-size: var(--sitemap-dev-badge-size);
		font-weight: 600;
		background: var(--form-error);
		color: var(--color-white);
		border-radius: var(--sitemap-dev-badge-radius);
		letter-spacing: 0.05em;
	}

	.sitemap-page__controls {
		display: grid;
		gap: var(--sitemap-controls-gap);
		margin-bottom: 1.25rem;
	}

	.sitemap-page__filters {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--sitemap-filters-gap);
		align-items: center;
	}

	.sitemap-page__tag-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sitemap-tag-gap);
	}

	.sitemap-page__filter-label {
		display: inline-flex;
		align-items: center;
		gap: var(--sitemap-filter-label-gap);
		font-size: var(--sitemap-filter-label-size);
		color: var(--muted);
		margin-right: 0.35rem;
		padding-right: 0.1rem;
	}

	.sitemap-page__sort-view {
		display: flex;
		gap: var(--sitemap-sort-gap);
		justify-self: end;
	}

	@media (max-width: 600px) {
		.sitemap-page__filters {
			grid-template-columns: 1fr;
			align-items: stretch;
		}

		.sitemap-page__sort-view {
			justify-self: start;
		}
	}
</style>
