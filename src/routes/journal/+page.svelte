<script>
	import { ArrowUpRight, CalendarDays, Tag } from '@lucide/svelte'
	import PageContainer from '$lib/ui/PageContainer.svelte'
	import ResultsEmpty from '$lib/ui/ResultsEmpty.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import SearchToolbar from '$lib/ui/SearchToolbar.svelte'
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte'

	let { data } = $props()

	let searchQuery = $state('')
	let selectedCategory = $state('all')
	let sortBy = $state('newest')
	const sortOptions = [
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' },
		{ value: 'title', label: 'Title' }
	]

	function formatDate(value, mode = 'short') {
		const d = new Date(value)
		if (mode === 'year') return String(d.getFullYear())
		if (mode === 'monthDay') {
			return d.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric'
			})
		}
		return d.toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric'
		})
	}

	function firstCategory(post) {
		return post.metadata.fm.categories?.[0] || ''
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
			if (sortBy === 'title') return a.metadata.fm.title.localeCompare(b.metadata.fm.title)
			const aTime = new Date(a.date).getTime()
			const bTime = new Date(b.date).getTime()
			if (sortBy === 'oldest') return aTime - bTime
			return bTime - aTime
		})
	})

	const groupedByYear = $derived.by(() => {
		const groups = {}
		for (const post of filteredPosts) {
			const year = formatDate(post.date, 'year')
			if (!groups[year]) groups[year] = []
			groups[year].push(post)
		}
		return groups
	})

	const yearOrder = $derived.by(() => Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a)))
</script>

<svelte:head>
	<title>Journal - MIKO.ART</title>
</svelte:head>

<Hero
	title="Journal"
	subtitle="Thoughts, process notes, and little breakthroughs."
	icon="/media/emoji-journal.png"
/>

<PageContainer className="journal-page">
	<div class="journal-page__tools" aria-label="Journal filters">
		<SearchToolbar bind:query={searchQuery} placeholder="Search posts..." ariaLabel="Search posts">
			<div class="journal-page__selects">
				<label>
					<span>Category</span>
					<select bind:value={selectedCategory}>
						<option value="all">All</option>
						{#each availableCategories as category}
							<option value={category}>{category}</option>
						{/each}
					</select>
				</label>
				<div class="journal-page__sort-control">
					<span>Sort</span>
					<SegmentedControl options={sortOptions} bind:value={sortBy} ariaLabel="Sort posts" />
				</div>
			</div>
		</SearchToolbar>
	</div>

	{#if filteredPosts.length === 0}
		<ResultsEmpty
			className="journal-page__no-results"
			message="No posts match your filters."
			onAction={() => { searchQuery = ''; selectedCategory = 'all'; sortBy = 'newest' }}
		/>
	{:else}
		<p class="ui-search__results-count results-count journal-page__results">{filteredPosts.length} entries</p>

		{#each yearOrder as year}
			<section class="year-group journal-page__year-group">
				<h2>{year}</h2>
				<ol>
					{#each groupedByYear[year] as post}
						<li>
							<article class="journal-page__entry">
								<div class="journal-page__entry-date">
									<CalendarDays size={14} strokeWidth={2.2} />
									<span>{formatDate(post.date, 'monthDay')}</span>
								</div>

								<h3 class="journal-page__entry-title">
									<a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
								</h3>

								<div class="journal-page__entry-right">
									{#if firstCategory(post)}
										<a
											class="journal-page__tag"
											href={`/journal/category/${firstCategory(post).toLowerCase().replace(/\s+/g, '-')}`}
										>
											<Tag size={13} strokeWidth={2.2} />
											<span>{firstCategory(post)}</span>
										</a>
									{/if}

									<a href={`/${post.urlPath}`} class="journal-page__read-link">
										<span>Read</span>
										<ArrowUpRight size={14} strokeWidth={2.2} />
									</a>
								</div>
							</article>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	{/if}
</PageContainer>

<style>
	.journal-page__tools {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: end;
		margin-bottom: 0.9rem;
	}

	.journal-page__selects {
		display: flex;
		gap: 0.55rem;
	}

	.journal-page__selects label {
		display: grid;
		gap: 0.25rem;
	}

	.journal-page__sort-control {
		display: grid;
		gap: 0.25rem;
	}

	.journal-page__selects span {
		font-size: 0.75rem;
		color: var(--muted);
		font-family: var(--font-sans);
	}

	select {
		padding: 0.45rem 0.55rem;
		border-radius: 5px;
		border: 1px solid var(--border);
		background: var(--card-bg);
		color: var(--text);
		font-size: 0.86rem;
	}

	.journal-page__results {
		margin-bottom: 1rem;
	}

	.journal-page__year-group {
		margin-bottom: 1.7rem;
	}

	.journal-page__year-group h2 {
		margin: 0 0 0.55rem;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.1;
	}

	.journal-page__year-group ol {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--panel-border);
	}

	.journal-page__entry {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--panel-border);
	}

	.journal-page__entry-date {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.82rem;
		font-family: var(--font-sans);
		color: var(--muted);
	}

	.journal-page__entry-title {
		margin: 0;
		min-width: 0;
		font-family: var(--font-display);
		font-weight: 500;
		font-size: clamp(1.05rem, 1.6vw, 1.45rem);
		line-height: 1.24;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.journal-page__entry-title a {
		text-decoration: none;
		color: var(--text);
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.journal-page__entry-title a:hover {
		color: var(--link-hover);
	}

	.journal-page__entry-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.journal-page__tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.74rem;
		padding: 0.16rem 0.5rem;
		border-radius: 999px;
		background: var(--tag-bg);
		color: var(--muted);
		text-decoration: none;
	}

	.journal-page__tag:hover {
		background: var(--tag-hover-bg);
	}

	.journal-page__read-link {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--muted);
		white-space: nowrap;
	}

	.journal-page__read-link:hover {
		color: var(--link-hover);
	}

	@media (max-width: 860px) {
		.journal-page__tools {
			grid-template-columns: 1fr;
		}

		.journal-page__entry {
			grid-template-columns: 1fr;
			gap: 0.45rem;
		}

		.journal-page__entry-title,
		.journal-page__entry-title a {
			white-space: normal;
			overflow: visible;
			text-overflow: initial;
		}

		.journal-page__entry-right {
			justify-content: space-between;
		}

		.journal-page__read-link {
			width: fit-content;
		}
	}
</style>
