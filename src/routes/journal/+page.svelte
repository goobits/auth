<script>
	import { ArrowUpRight, CalendarDays, Tag } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'
	let { data } = $props()
</script>

<svelte:head>
    <title>Journal - MIKO.ART</title>
</svelte:head>

<HeroBanner
	title="Journal"
	subtitle="Thoughts, process notes, and little breakthroughs."
	icon="/media/emoji-journal.png"
/>

<div class="posts">
    {#each data.posts as post}
        <article>
            <h2>
                <a href={`/${post.urlPath}`}>
					<span>{post.metadata.fm.title}</span>
					<ArrowUpRight class="title-arrow" size={16} strokeWidth={2.2} />
				</a>
                <time>
					<CalendarDays size={14} strokeWidth={2.2} />
					<span>{new Date(post.date).toLocaleDateString('en-US', {
						month: 'numeric',
						day: 'numeric',
						year: 'numeric'
					})}</span>
				</time>
            </h2>
            {#if post.metadata.fm.categories}
                <div class="categories">
					<Tag class="category-icon" size={13} strokeWidth={2.2} />
                    {#each post.metadata.fm.categories as category}
                        <span class="category">{category}</span>
                    {/each}
                </div>
            {/if}
        </article>
    {/each}
</div>

<style>
	.posts {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	article {
		margin-bottom: 3rem;
		font-family: "Source Serif Pro", serif;
	}

    h2 {
		font-weight: 400;
		font-size: 2rem;
		margin: 0;
		text-align: left;
		font-family: "Playfair Display", serif;
	}

	time {
		font-family: "Source Serif Pro", serif;
		font-size: 1rem;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.title-arrow {
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	a:hover .title-arrow {
		opacity: 1;
	}

	.categories {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.category-icon {
		color: var(--muted);
	}

	.category {
		font-size: 0.875rem;
		color: var(--muted);
		background: var(--tag-bg);
		padding: 0.2rem 0.6rem;
		border-radius: 3px;
	}
</style>
