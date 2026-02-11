<script>
	import {
		ArrowUpRight,
		BookOpen,
		ChevronDown,
		ChevronRight,
		Clock3,
		Filter,
		Search,
		Tag,
		Type
	} from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	let { data } = $props()

	let searchQuery = $state('')
	let selectedCategory = $state('all')
	let sortBy = $state('newest')
	let collapsedYears = $state({})

	function formatDate(value) {
		const d = new Date(value)
		return d.toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric'
		})
	}

	const availableCategories = $derived.by(() => {
		const all = new Set()
		for (const post of data.posts) {
			for (const category of post.metadata.fm.categories || []) {
				all.add(category)
			}
		}
		return [...all].sort((a, b) => a.localeCompare(b))
	})

	const filteredPosts = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase()

		const filtered = data.posts.filter((post) => {
			if (selectedCategory !== 'all') {
				const categories = post.metadata.fm.categories || []
				if (!categories.includes(selectedCategory)) return false
			}

			if (!query) return true

			const title = (post.metadata.fm.title || '').toLowerCase()
			const path = (post.urlPath || '').toLowerCase()
			return title.includes(query) || path.includes(query)
		})

		return filtered.sort((a, b) => {
			if (sortBy === 'title') {
				return a.metadata.fm.title.localeCompare(b.metadata.fm.title)
			}
			const aTime = new Date(a.date).getTime()
			const bTime = new Date(b.date).getTime()
			if (sortBy === 'oldest') return aTime - bTime
			return bTime - aTime
		})
	})

	const groupedByYear = $derived.by(() => {
		const groups = {}
		for (const post of filteredPosts) {
			const year = String(new Date(post.date).getFullYear())
			if (!groups[year]) groups[year] = []
			groups[year].push(post)
		}
		return groups
	})

	const yearOrder = $derived.by(() => {
		return Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a))
	})

	function toggleYear(year) {
		collapsedYears[year] = !collapsedYears[year]
	}
</script>

<svelte:head>
	<title>Journal - MIKO.ART</title>
</svelte:head>

<HeroBanner
	title="Journal"
	subtitle="Thoughts, process notes, and little breakthroughs."
	icon="/media/emoji-journal.png"
/>

<div class="journal">
	<div class="controls">
		<div class="search-field">
			<Search class="search-icon" size={15} strokeWidth={2.2} />
			<input
				type="text"
				placeholder="Search posts..."
				bind:value={searchQuery}
			/>
		</div>

		<div class="filters">
			<div class="tag-filters">
				<span class="filter-label">
					<Filter size={13} strokeWidth={2.2} />
					<span>Category</span>
				</span>
				<button class="tag-filter" class:active={selectedCategory === 'all'} onclick={() => (selectedCategory = 'all')}>All</button>
				{#each availableCategories as category}
					<button
						class="tag-filter"
						class:active={selectedCategory === category}
						onclick={() => (selectedCategory = category)}
					>
						{category}
					</button>
				{/each}
			</div>

			<div class="sort-view">
				<div class="sort-toggle" role="tablist" aria-label="Sort posts">
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'newest'}
						aria-selected={sortBy === 'newest'}
						onclick={() => (sortBy = 'newest')}
					>
						<Clock3 size={13} strokeWidth={2.2} />
						<span>Newest</span>
					</button>
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'oldest'}
						aria-selected={sortBy === 'oldest'}
						onclick={() => (sortBy = 'oldest')}
					>
						<Clock3 size={13} strokeWidth={2.2} />
						<span>Oldest</span>
					</button>
					<button
						type="button"
						role="tab"
						class:active={sortBy === 'title'}
						aria-selected={sortBy === 'title'}
						onclick={() => (sortBy = 'title')}
					>
						<Type size={13} strokeWidth={2.2} />
						<span>Title</span>
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if filteredPosts.length === 0}
		<div class="no-results">
			<p>No posts match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedCategory = 'all' }}>Clear Filters</button>
		</div>
	{:else}
		<div class="results-count">Showing {filteredPosts.length} of {data.posts.length} posts</div>

		{#each yearOrder as year}
			<section class="category">
				<button class="category-header" onclick={() => toggleYear(year)}>
					<h2>
						<BookOpen class="category-icon" size={14} strokeWidth={2.2} />
						{#if collapsedYears[year]}
							<ChevronRight class="toggle-icon" size={14} strokeWidth={2.25} />
						{:else}
							<ChevronDown class="toggle-icon" size={14} strokeWidth={2.25} />
						{/if}
						{year}
						<span class="count">({groupedByYear[year].length})</span>
					</h2>
				</button>

				{#if !collapsedYears[year]}
					<ul>
						{#each groupedByYear[year] as post}
							<li class="route">
								<div class="route-main">
									<a href={`/${post.urlPath}`} class="route-link">
										<span>{post.metadata.fm.title}</span>
										<ArrowUpRight class="title-arrow" size={15} strokeWidth={2.2} />
									</a>
								</div>
								<div class="route-meta">
									<div class="tags">
										{#if post.metadata.fm.categories?.length}
											<Tag class="tag-icon" size={13} strokeWidth={2.2} />
											{#each post.metadata.fm.categories as category}
												<span class="tag">{category}</span>
											{/each}
										{/if}
									</div>
									<span class="modified">{formatDate(post.date)}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}
</div>

<style>
	.journal {
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
		color: white;
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
		padding: 0.45rem 0;
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
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		text-decoration: none;
		color: var(--text);
		min-width: 0;
		font-family: "Playfair Display", serif;
		font-size: 1.25rem;
	}

	.route-link:hover {
		color: var(--link-hover);
	}

	.title-arrow {
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.route-link:hover .title-arrow {
		opacity: 1;
	}

	.route-meta {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-shrink: 0;
	}

	.tags {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	.tag-icon {
		color: var(--muted);
		align-self: center;
	}

	.tag {
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		background: var(--tag-bg);
		color: var(--text);
	}

	.modified {
		font-size: 0.75rem;
		color: var(--muted);
		width: 5.5rem;
		text-align: right;
		font-family: monospace;
	}

	@media (max-width: 700px) {
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
			justify-content: space-between;
		}
	}

	@media (max-width: 560px) {
		.route-link {
			font-size: 1.05rem;
		}

		.modified {
			display: none;
		}
	}
</style>
