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
