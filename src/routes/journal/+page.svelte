<script>
	import { ArrowUpRight, CalendarDays, Tag } from '@lucide/svelte'
	import PageContainer from '$lib/ui/PageContainer.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import FilterableCollection from '$lib/ui/FilterableCollection.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import SearchToolbar from '$lib/ui/SearchToolbar.svelte'
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte'
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
	<Hero
		eyebrow="Journal"
		title="Journal 📔"
		subtitle="Thoughts, process notes, and little breakthroughs."
	/>

	<PageContainer className="journal-page__content">
		<FilterableCollection
			className="journal-page__collection"
			count={filteredPosts.length}
			countLabel="entries"
			emptyMessage="No posts match your filters."
			onClear={() => { searchQuery = ''; selectedCategory = 'all'; sortBy = 'newest' }}
		>
			{#snippet toolbar()}
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
			{/snippet}

			{#each yearOrder as year}
				<section class="year-group journal-page__year-group">
					<h2>{year}</h2>
					<ol>
						{#each groupedByYear[year] as post}
							<li>
								<article class="journal-page__entry">
									<div class="journal-page__entry-date">
										<CalendarDays size={14} strokeWidth={2.2} />
										<span>{formatDateMonthDay(post.date)}</span>
									</div>

									<h3 class="journal-page__entry-title">
										<a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
									</h3>

									<div class="journal-page__entry-right">
										{#if getFirstCategory(post)}
											<a
												class="journal-page__tag"
												href={`/journal/category/${slugify(getFirstCategory(post))}`}
											>
												<Tag size={13} strokeWidth={2.2} />
												<span>{getFirstCategory(post)}</span>
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
		</FilterableCollection>
	</PageContainer>
</PageShell>

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
