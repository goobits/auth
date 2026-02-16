<script>
	import { Search } from '@lucide/svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import ResultsEmpty from '$lib/ui/ResultsEmpty.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import { slugify } from '$lib/utils/collections'
	import { formatDateMonthDay } from '$lib/utils/date'
	import {
		filterAndSortJournalPosts,
		getFirstCategory,
		getJournalCategories,
		getJournalYearOrder,
		groupJournalPostsByYear
	} from '$lib/viewmodels/journal'

	let { data } = $props()

	let searchQuery = $state('')
	let selectedCategory = $state('all')
	let sortBy = $state('newest')
	const sortOptions = [
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' },
		{ value: 'title', label: 'Title' }
	]

	const availableCategories = $derived(getJournalCategories(data.posts))
	const filteredPosts = $derived(filterAndSortJournalPosts(data.posts, searchQuery, selectedCategory, sortBy))
	const groupedByYear = $derived(groupJournalPostsByYear(filteredPosts))
	const yearOrder = $derived(getJournalYearOrder(groupedByYear))
</script>

<svelte:head>
	<title>Journal - MIKO.ART</title>
</svelte:head>

<PageShell className="journal-page">
	<div class="journal-page__inner">
		<Hero
			eyebrow="Journal"
			title="Journal"
			icon="/media/journal-journaling.png"
			iconAlt="Journal icon"
			iconSize="0.95em"
			subtitle="Thoughts, process notes, and little breakthroughs."
		/>

			<section class="journal-page__toolbar" aria-label="Journal filters">
				<label class="journal-page__search" aria-label="Search posts">
					<span class="journal-page__search-icon" aria-hidden="true">
						<Search size={15} strokeWidth={2.2} />
					</span>
					<input
						class="journal-page__search-input"
						type="text"
						placeholder="Search posts..."
					bind:value={searchQuery}
				/>
			</label>

			<label class="journal-page__select">
				<span class="journal-page__select-label">Category</span>
				<select class="journal-page__select-control" bind:value={selectedCategory} aria-label="Category">
					<option value="all">All categories</option>
					{#each availableCategories as category}
						<option value={category}>{category}</option>
					{/each}
				</select>
			</label>

			<div class="journal-page__sort" role="tablist" aria-label="Sort posts">
				{#each sortOptions as option}
					<button
						type="button"
						role="tab"
						class={`journal-page__sort-button ${sortBy === option.value ? 'journal-page__sort-button--active' : ''}`}
						aria-selected={sortBy === option.value}
						onclick={() => (sortBy = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</section>

		{#if filteredPosts.length === 0}
			<ResultsEmpty
				message="No posts match your filters."
				onAction={() => {
					searchQuery = ''
					selectedCategory = 'all'
					sortBy = 'newest'
				}}
			/>
		{:else}
			<p class="journal-page__count">{filteredPosts.length} {filteredPosts.length === 1 ? 'entry' : 'entries'}</p>

			{#each yearOrder as year}
				<section class="journal-page__year-group" aria-label={`Posts from ${year}`}>
					<h2 class="journal-page__year">{year}</h2>
					<ol class="journal-page__list">
						{#each groupedByYear[year] as post}
							<li class="journal-page__item">
								<article class="journal-page__row">
									<div class="journal-page__date">{formatDateMonthDay(post.date)}</div>

									<h3 class="journal-page__post-title">
										<a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
									</h3>

									<div class="journal-page__meta">
										{#if getFirstCategory(post)}
											<a
												class="journal-page__tag"
												href={`/journal/category/${slugify(getFirstCategory(post))}`}
											>
												{getFirstCategory(post)}
											</a>
										{/if}
									</div>
								</article>
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		{/if}
	</div>
</PageShell>

<style>
	.journal-page__inner {
		padding-inline: 1.5rem;
	}

	.journal-page__toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.journal-page__search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1 1 240px;
		min-width: 180px;
		border: 1.5px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-pill);
		background: transparent;
		padding: 0.1rem 0.9rem;
		transition: border-color 0.25s;
	}

	.journal-page__search:focus-within {
		border-color: color-mix(in srgb, var(--text) 55%, var(--border));
	}

	.journal-page__search-icon {
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		flex-shrink: 0;
	}

	.journal-page__search-input {
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text);
		background: transparent;
		border: none;
		padding: 0.75rem 0;
		margin: 0;
	}

	.journal-page__search-input:focus {
		outline: none;
	}

	.journal-page__select {
		display: grid;
		gap: 0.25rem;
	}

	.journal-page__select-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-family: var(--font-sans);
	}

	.journal-page__select-control {
		font-family: var(--font-sans);
		font-size: var(--font-size-xs);
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		background: transparent;
		border: 1.5px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-pill);
		padding: 0.6rem 0.95rem;
		outline: none;
		cursor: pointer;
		appearance: none;
	}

	.journal-page__select-control:focus {
		border-color: color-mix(in srgb, var(--text) 55%, var(--border));
	}

	.journal-page__sort {
		display: inline-flex;
		align-items: center;
		border: 1.5px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.journal-page__sort-button {
		border: none;
		background: transparent;
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-family: var(--font-sans);
		font-size: var(--font-size-xs);
		padding: 0.6rem 0.95rem;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
	}

	.journal-page__sort-button--active {
		background: var(--text);
		color: var(--bg);
	}

	.journal-page__count {
		margin: 1rem 0 0.5rem;
		font-size: var(--font-size-xs);
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-family: var(--font-sans);
	}

	.journal-page__year-group {
		margin-bottom: 2rem;
	}

	.journal-page__year {
		margin: 0;
		padding-top: 2.5rem;
		font-family: var(--font-display);
		font-weight: 500;
		font-size: 1.25rem;
		letter-spacing: -0.015em;
		color: var(--text);
	}

	.journal-page__list {
		margin: 0;
		padding: 0.5rem 0 0;
		list-style: none;
	}

	.journal-page__item {
		margin: 0;
		padding: 0;
	}

	.journal-page__row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 0 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
		transition: opacity 0.2s, border-color 0.2s;
	}

	.journal-page__row:hover {
		opacity: 0.7;
		border-bottom-color: color-mix(in srgb, var(--border) 85%, transparent);
	}

	.journal-page__date {
		font-size: var(--font-size-xs);
		font-family: var(--font-sans);
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.journal-page__post-title {
		margin: 0;
		min-width: 0;
		font-family: var(--font-sans);
		font-weight: 400;
		font-size: var(--font-size-sm);
		letter-spacing: -0.005em;
	}

	.journal-page__post-title a {
		text-decoration: none;
		color: var(--text);
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.journal-page__post-title a:hover {
		color: var(--link-hover);
	}

	.journal-page__meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		white-space: nowrap;
	}

	.journal-page__tag {
		display: inline-flex;
		align-items: center;
		font-size: 0.6875rem;
		font-weight: var(--font-weight-medium);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-sm);
		color: color-mix(in srgb, var(--link) 70%, var(--text));
		background: color-mix(in srgb, var(--link) 9%, transparent);
		text-decoration: none;
	}

	.journal-page__tag:hover {
		background: color-mix(in srgb, var(--link-hover) 10%, transparent);
		color: color-mix(in srgb, var(--link-hover) 72%, var(--text));
	}

	@media (max-width: 860px) {
		.journal-page__row {
			grid-template-columns: 1fr;
			gap: 0.45rem;
		}

		.journal-page__post-title a {
			white-space: normal;
			overflow: visible;
			text-overflow: initial;
		}

		.journal-page__meta {
			justify-content: space-between;
		}
	}
</style>
