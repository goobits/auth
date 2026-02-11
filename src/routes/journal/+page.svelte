<script>
	import { ArrowUpRight, CalendarDays, Search, Tag } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	let { data } = $props()

	let searchQuery = $state('')
	let selectedCategory = $state('all')
	let sortBy = $state('newest')

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

<HeroBanner
	title="Journal"
	subtitle="Thoughts, process notes, and little breakthroughs."
	icon="/media/emoji-journal.png"
/>

<div class="journal">
	<div class="journal-tools" aria-label="Journal filters">
		<label class="search-field" aria-label="Search posts">
			<Search class="search-icon" size={15} strokeWidth={2.2} />
			<input type="text" placeholder="Search posts..." bind:value={searchQuery} />
		</label>

		<div class="selects">
			<label>
				<span>Category</span>
				<select bind:value={selectedCategory}>
					<option value="all">All</option>
					{#each availableCategories as category}
						<option value={category}>{category}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Sort</span>
				<select bind:value={sortBy}>
					<option value="newest">Newest</option>
					<option value="oldest">Oldest</option>
					<option value="title">Title</option>
				</select>
			</label>
		</div>
	</div>

	{#if filteredPosts.length === 0}
		<div class="no-results">
			<p>No posts match your filters.</p>
			<button onclick={() => { searchQuery = ''; selectedCategory = 'all'; sortBy = 'newest' }}>Clear Filters</button>
		</div>
	{:else}
		<p class="results-count">{filteredPosts.length} entries</p>

		{#each yearOrder as year}
			<section class="year-group">
				<h2>{year}</h2>
				<ol>
					{#each groupedByYear[year] as post}
						<li>
							<article class="entry">
								<div class="entry-date">
									<CalendarDays size={14} strokeWidth={2.2} />
									<span>{formatDate(post.date, 'monthDay')}</span>
								</div>

								<h3 class="entry-title">
									<a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
								</h3>

								<div class="entry-right">
									{#if firstCategory(post)}
										<a
											class="tag"
											href={`/journal/category/${firstCategory(post).toLowerCase().replace(/\s+/g, '-')}`}
										>
											<Tag size={13} strokeWidth={2.2} />
											<span>{firstCategory(post)}</span>
										</a>
									{/if}

									<a href={`/${post.urlPath}`} class="read-link">
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
</div>

<style>
	.journal {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.journal-tools {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: end;
		margin-bottom: 0.9rem;
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

	.search-icon {
		color: var(--muted);
		flex-shrink: 0;
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

	.selects {
		display: flex;
		gap: 0.55rem;
	}

	.selects label {
		display: grid;
		gap: 0.25rem;
	}

	.selects span {
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

	.results-count {
		margin: 0 0 1rem;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.year-group {
		margin-bottom: 1.7rem;
	}

	.year-group h2 {
		margin: 0 0 0.55rem;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1.1;
	}

	.year-group ol {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--panel-border);
	}

	.entry {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--panel-border);
	}

	.entry-date {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.82rem;
		font-family: var(--font-sans);
		color: var(--muted);
	}

	.entry-title {
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

	.entry-title a {
		text-decoration: none;
		color: var(--text);
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.entry-title a:hover {
		color: var(--link-hover);
	}

	.entry-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.tag {
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

	.tag:hover {
		background: var(--tag-hover-bg);
	}

	.read-link {
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

	.read-link:hover {
		color: var(--link-hover);
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

	@media (max-width: 860px) {
		.journal-tools {
			grid-template-columns: 1fr;
		}

		.entry {
			grid-template-columns: 1fr;
			gap: 0.45rem;
		}

		.entry-title,
		.entry-title a {
			white-space: normal;
			overflow: visible;
			text-overflow: initial;
		}

		.entry-right {
			justify-content: space-between;
		}

		.read-link {
			width: fit-content;
		}
	}
</style>
